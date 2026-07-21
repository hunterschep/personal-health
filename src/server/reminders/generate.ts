import type {
  ClinicianOverride,
  CustomMaintenance,
  Medication,
  PlannedAction,
  RecommendationClass,
  RecommendationStatus,
} from "@/generated/prisma/client";
import { addCalendarDays } from "@/domain/dates";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/transactions";

import { smtpSettings } from "./email";
import { applyQuietTime, reminderSchedulingPreferences } from "./preferences";
import { localDateKey, localDateTimeParts, localDateTimeToInstant } from "./timezone";

export type ReminderCandidate = {
  profileId: string;
  plannedActionId: string | null;
  recommendationInstanceId: string | null;
  channel: "in_app" | "email";
  remindAt: Date;
  status: "pending";
  dedupeKey: string;
};

type RecommendationCandidateInput = {
  id: string;
  profileId: string;
  status: RecommendationStatus;
  recommendationClass: RecommendationClass;
  dueStart: Date | null;
  activeOverrideId?: string | null;
};

type CustomMaintenanceCandidateInput = Pick<
  CustomMaintenance,
  "id" | "profileId" | "status" | "nextDate" | "reminderEnabled" | "reminderDaysBefore"
>;

type MedicationReviewCandidateInput = Pick<
  Medication,
  "id" | "profileId" | "status" | "nextReviewDate" | "deletedAt"
>;

type ClinicianPlanReviewCandidateInput = Pick<
  ClinicianOverride,
  "id" | "profileId" | "active" | "reviewDate"
>;

type PlannedActionCandidateInput = Pick<
  PlannedAction,
  "id" | "profileId" | "plannedMonth" | "appointmentStart" | "timezone" | "status"
>;

const EXCLUDED_STATUSES = new Set<RecommendationStatus>([
  "future",
  "up_to_date",
  "not_routinely_recommended",
  "not_applicable",
  "completed_once",
]);

export function recommendationCandidate(
  recommendation: RecommendationCandidateInput,
  timezone: string,
  now: Date,
): ReminderCandidate | null {
  if (
    EXCLUDED_STATUSES.has(recommendation.status) ||
    recommendation.recommendationClass === "not_recommended" ||
    recommendation.recommendationClass === "insufficient_evidence" ||
    ((recommendation.recommendationClass === "shared_decision" ||
      recommendation.recommendationClass === "selective") &&
      recommendation.activeOverrideId == null)
  ) {
    return null;
  }

  const nowDate = localDateKey(now, timezone);
  const dueDate = recommendation.dueStart?.toISOString().slice(0, 10) ?? null;
  if (dueDate === null && recommendation.status === "clinician_managed") return null;
  const remindAt =
    dueDate !== null && dueDate > nowDate ? localDateTimeToInstant(dueDate, 9, 0, timezone) : now;
  const cadence =
    recommendation.status === "overdue"
      ? `overdue:${nowDate.slice(0, 7)}`
      : recommendation.status === "unknown_history" ||
          recommendation.status === "needs_date_confirmation"
        ? "history-once"
        : recommendation.status;
  return {
    profileId: recommendation.profileId,
    plannedActionId: null,
    recommendationInstanceId: recommendation.id,
    channel: "in_app",
    remindAt,
    status: "pending",
    dedupeKey: `recommendation:${recommendation.id}:${cadence}`,
  };
}

function dateCandidate(
  input: {
    profileId: string;
    dedupeKey: string;
    date: Date;
    daysBefore?: number;
  },
  timezone: string,
  now: Date,
): ReminderCandidate {
  const daysBefore = input.daysBefore ?? 0;
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 365) {
    throw new RangeError("Reminder offsets must be between 0 and 365 days.");
  }
  const date = input.date.toISOString().slice(0, 10);
  const reminderDate = addCalendarDays(date, -daysBefore);
  const scheduled = localDateTimeToInstant(reminderDate, 9, 0, timezone);
  return {
    profileId: input.profileId,
    plannedActionId: null,
    recommendationInstanceId: null,
    channel: "in_app",
    remindAt: scheduled > now ? scheduled : now,
    status: "pending",
    dedupeKey: input.dedupeKey,
  };
}

export function customMaintenanceCandidate(
  item: CustomMaintenanceCandidateInput,
  timezone: string,
  now: Date,
): ReminderCandidate | null {
  if (
    item.status !== "active" ||
    !item.reminderEnabled ||
    item.nextDate === null ||
    item.reminderDaysBefore === null
  ) {
    return null;
  }
  const nextDate = item.nextDate.toISOString().slice(0, 10);
  return dateCandidate(
    {
      profileId: item.profileId,
      date: item.nextDate,
      daysBefore: item.reminderDaysBefore,
      dedupeKey: `custom-maintenance:${item.id}:${nextDate}:days-before:${item.reminderDaysBefore}`,
    },
    timezone,
    now,
  );
}

export function medicationReviewCandidate(
  medication: MedicationReviewCandidateInput,
  timezone: string,
  now: Date,
): ReminderCandidate | null {
  if (
    medication.deletedAt !== null ||
    medication.status === "ended" ||
    medication.nextReviewDate === null
  ) {
    return null;
  }
  const reviewDate = medication.nextReviewDate.toISOString().slice(0, 10);
  return dateCandidate(
    {
      profileId: medication.profileId,
      date: medication.nextReviewDate,
      dedupeKey: `medication-review:${medication.id}:${reviewDate}`,
    },
    timezone,
    now,
  );
}

export function clinicianPlanReviewCandidate(
  override: ClinicianPlanReviewCandidateInput,
  timezone: string,
  now: Date,
  recommendationInstanceId: string | null = null,
): ReminderCandidate | null {
  if (!override.active || override.reviewDate === null) return null;
  const reviewDate = override.reviewDate.toISOString().slice(0, 10);
  return {
    ...dateCandidate(
      {
        profileId: override.profileId,
        date: override.reviewDate,
        dedupeKey: `clinician-plan-review:${override.id}:${reviewDate}`,
      },
      timezone,
      now,
    ),
    recommendationInstanceId,
  };
}

export function plannedActionCandidate(
  action: PlannedActionCandidateInput,
  timezone: string,
  appointmentReminderDaysBefore: number | null = null,
  now = new Date(),
): ReminderCandidate | null {
  if (action.status !== "planned" && action.status !== "scheduled") return null;
  if (action.appointmentStart !== null) {
    if (appointmentReminderDaysBefore === null) return null;
    if (
      !Number.isInteger(appointmentReminderDaysBefore) ||
      appointmentReminderDaysBefore < 0 ||
      appointmentReminderDaysBefore > 365
    ) {
      throw new RangeError("Appointment reminder offsets must be between 0 and 365 days.");
    }
    const local = localDateTimeParts(action.appointmentStart, action.timezone || timezone);
    const appointmentDate = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
    const reminderDate = addCalendarDays(appointmentDate, -appointmentReminderDaysBefore);
    const remindAt = localDateTimeToInstant(
      reminderDate,
      local.hour,
      local.minute,
      action.timezone || timezone,
    );
    return {
      profileId: action.profileId,
      plannedActionId: action.id,
      recommendationInstanceId: null,
      channel: "in_app",
      remindAt: remindAt > now ? remindAt : now,
      status: "pending",
      dedupeKey: `planned-action:${action.id}:appointment:${action.appointmentStart.toISOString()}:days-before:${appointmentReminderDaysBefore}`,
    };
  }
  if (action.status !== "planned" || action.plannedMonth === null) return null;
  const date = `${action.plannedMonth.toISOString().slice(0, 7)}-01`;
  return {
    profileId: action.profileId,
    plannedActionId: action.id,
    recommendationInstanceId: null,
    channel: "in_app",
    remindAt: localDateTimeToInstant(date, 9, 0, timezone),
    status: "pending",
    dedupeKey: `planned-action:${action.id}:month`,
  };
}

export async function generateRemindersForProfile(
  profileId: string,
  now = new Date(),
  database: DatabaseClient = prisma,
): Promise<{ candidateCount: number; createdCount: number }> {
  const profile = await database.profile.findFirst({
    where: { id: profileId, deletedAt: null },
    include: {
      recommendations: {
        where: { retiredAt: null },
      },
      plannedActions: { where: { status: { in: ["planned", "scheduled"] } } },
      customMaintenance: {
        where: {
          status: "active",
          reminderEnabled: true,
          nextDate: { not: null },
          visibility: "profile_access",
        },
      },
      medications: {
        where: {
          deletedAt: null,
          status: { in: ["active", "paused"] },
          nextReviewDate: { not: null },
        },
      },
      clinicianOverrides: {
        where: { active: true, pausedAt: null, reviewDate: { not: null } },
      },
      reminderPreferences: true,
    },
  });
  if (profile === null) throw new RangeError("The profile is no longer available.");
  const preferenceUserId = profile.ownerUserId ?? profile.createdByUserId;
  const storedPreference = profile.reminderPreferences.find(
    (preference) => preference.userId === preferenceUserId,
  );
  const inAppEnabled = storedPreference?.inAppEnabled ?? true;
  const emailEnabled =
    profile.ownerUserId !== null &&
    storedPreference?.emailEnabled === true &&
    smtpSettings() !== null;
  const unknownHistoryPrompts = storedPreference?.unknownHistoryPrompts ?? true;
  const schedulingPreferences = reminderSchedulingPreferences(storedPreference, profile.timezone);
  const generalCandidates = [
    ...profile.recommendations.map((recommendation) =>
      recommendationCandidate(recommendation, schedulingPreferences.timezone, now),
    ),
    ...profile.plannedActions.map((action) =>
      plannedActionCandidate(action, schedulingPreferences.timezone),
    ),
  ].filter((candidate): candidate is ReminderCandidate => candidate !== null);
  const personalCandidates = [
    ...profile.customMaintenance.map((item) =>
      customMaintenanceCandidate(item, schedulingPreferences.timezone, now),
    ),
    ...profile.medications.map((medication) =>
      medicationReviewCandidate(medication, schedulingPreferences.timezone, now),
    ),
    ...profile.clinicianOverrides.map((override) =>
      clinicianPlanReviewCandidate(
        override,
        schedulingPreferences.timezone,
        now,
        profile.recommendations.find(
          (recommendation) => recommendation.activeOverrideId === override.id,
        )?.id ?? null,
      ),
    ),
  ].filter((candidate): candidate is ReminderCandidate => candidate !== null);
  const eligibleGeneralCandidates = generalCandidates.filter((candidate) => {
    if (unknownHistoryPrompts) return true;
    const recommendation = profile.recommendations.find(
      (item) => item.id === candidate.recommendationInstanceId,
    );
    return (
      recommendation?.status !== "unknown_history" &&
      recommendation?.status !== "needs_date_confirmation"
    );
  });
  const schedule = (candidate: ReminderCandidate) => ({
    ...candidate,
    remindAt: applyQuietTime(candidate.remindAt, schedulingPreferences),
  });
  const candidates = [
    ...eligibleGeneralCandidates.flatMap((candidate) => [
      ...(inAppEnabled ? [schedule(candidate)] : []),
      ...(emailEnabled
        ? [
            {
              ...schedule(candidate),
              channel: "email" as const,
            },
          ]
        : []),
    ]),
    ...(inAppEnabled ? personalCandidates.map(schedule) : []),
  ];
  const activePersonalKeys = inAppEnabled
    ? personalCandidates.map(({ dedupeKey }) => dedupeKey)
    : [];
  await database.reminder.deleteMany({
    where: {
      profileId,
      channel: "in_app",
      status: "pending",
      AND: [
        {
          OR: [
            { dedupeKey: { startsWith: "custom-maintenance:" } },
            { dedupeKey: { startsWith: "medication-review:" } },
            { dedupeKey: { startsWith: "clinician-plan-review:" } },
          ],
        },
        ...(activePersonalKeys.length === 0 ? [] : [{ dedupeKey: { notIn: activePersonalKeys } }]),
      ],
    },
  });
  if (candidates.length === 0) return { candidateCount: 0, createdCount: 0 };
  const result = await database.reminder.createMany({ data: candidates, skipDuplicates: true });
  return { candidateCount: candidates.length, createdCount: result.count };
}
