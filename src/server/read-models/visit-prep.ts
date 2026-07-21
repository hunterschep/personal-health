import type { DatePrecision } from "@/generated/prisma/client";
import type { VisitPrepData } from "@/components/documents/visit-prep-types";
import { ageOnDate, dateInTimeZone } from "@/domain/dates";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { storedVisitPrepDraft } from "@/server/visit-prep/preferences";

import { displayDateRange, loadProfileCarePlan } from "./profiles";

function localDateKey(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatVisitPrepAppointment(
  start: Date,
  end: Date | null,
  timezone: string,
): string {
  const full = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  });
  if (end === null) return full.format(start);
  if (localDateKey(start, timezone) !== localDateKey(end, timezone)) {
    return `${full.format(start)} until ${full.format(end)}`;
  }
  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(end);
  return `${full.format(start)} until ${endTime}`;
}

export function formatVisitPrepEventDate(
  performedStart: Date | null,
  precision: DatePrecision,
): string {
  if (performedStart === null || precision === "unknown") return "date unknown";
  if (precision === "year") return String(performedStart.getUTCFullYear());
  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(performedStart);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(performedStart);
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}

export async function loadVisitPrepData(profileId: string): Promise<{
  profileId: string;
  canExport: boolean;
  canSave: boolean;
  draft: ReturnType<typeof storedVisitPrepDraft>;
  data: VisitPrepData;
}> {
  const [plan, session] = await Promise.all([loadProfileCarePlan(profileId), requireSession()]);
  const { profile } = plan;
  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setUTCFullYear(recentCutoff.getUTCFullYear() - 3);

  const [medications, conditions, recentEvents, overrides, appointments, preference] =
    await Promise.all([
      prisma.medication.findMany({
        where: { profileId: profile.id, status: "active", deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.condition.findMany({
        where: { profileId: profile.id, status: "active", deletedAt: null },
        orderBy: { displayName: "asc" },
      }),
      prisma.careEvent.findMany({
        where: {
          profileId: profile.id,
          deletedAt: null,
          result: { in: ["abnormal", "inconclusive"] },
          OR: [
            { performedEnd: { gte: recentCutoff } },
            { performedEnd: null, createdAt: { gte: recentCutoff } },
          ],
        },
        include: { service: true, method: true },
        orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.clinicianOverride.findMany({
        where: { profileId: profile.id, active: true, pausedAt: null },
        include: { service: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.plannedAction.findMany({
        where: {
          profileId: profile.id,
          status: { in: ["planned", "scheduled"] },
          appointmentStart: { gte: now },
        },
        orderBy: [{ appointmentStart: "asc" }, { createdAt: "asc" }],
        take: 10,
      }),
      prisma.visitPrepPreference.findUnique({
        where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
      }),
    ]);

  const sentence = (item: (typeof plan.recommendations)[number]): string =>
    `${item.service}: ${item.timing}.`;
  const profileToday = dateInTimeZone(now, profile.timezone);
  const clinicianRecommendations = plan.recommendations
    .filter(({ status }) => status === "clinician_managed")
    .map(sentence);
  const clinicianOverrides = overrides.map(
    (override) =>
      `${override.service.name}: ${override.overrideType.replaceAll("_", " ")}${override.nextDueStart === null ? "" : ` · ${displayDateRange(override.nextDueStart, override.nextDueEnd ?? override.nextDueStart)}`}`,
  );
  const draft = storedVisitPrepDraft(preference);
  const sourceLinks = [
    ...new Map(
      plan.recommendations.map((recommendation) => [
        recommendation.sourceUrl,
        { label: recommendation.source, url: recommendation.sourceUrl },
      ]),
    ).values(),
  ];

  return {
    profileId: profile.id,
    canExport: plan.capabilities.canExport,
    canSave: plan.capabilities.canEdit,
    draft,
    data: {
      profileName: profile.displayName,
      age: ageOnDate(profile.dateOfBirth.toISOString().slice(0, 10), profileToday),
      generatedOn: new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: profile.timezone,
      }).format(now),
      appointments: appointments.flatMap((appointment) =>
        appointment.appointmentStart === null
          ? []
          : [
              {
                title: appointment.title,
                timing: formatVisitPrepAppointment(
                  appointment.appointmentStart,
                  appointment.appointmentEnd,
                  appointment.timezone,
                ),
                timezone: appointment.timezone,
                location: appointment.location,
              },
            ],
      ),
      medications: medications.map(
        (medication) =>
          `${medication.name}${medication.dose === null ? "" : ` · ${medication.dose}`}${medication.frequency === null ? "" : ` · ${medication.frequency}`}`,
      ),
      conditions: conditions.map((condition) => condition.displayName),
      attention: plan.recommendations
        .filter(({ status }) =>
          ["overdue", "due_now", "due_soon", "needs_date_confirmation"].includes(status),
        )
        .map(sentence),
      thisYear: plan.recommendations
        .filter(({ status }) => status === "due_this_year")
        .map(sentence),
      unknown: plan.recommendations
        .filter(({ status }) => status === "unknown_history")
        .map(sentence),
      discussion: plan.recommendations
        .filter(
          ({ status, recommendationClass }) =>
            ["discuss_with_clinician", "not_routinely_recommended"].includes(status) ||
            ["shared-decision", "selective", "insufficient-evidence"].includes(recommendationClass),
        )
        .map(sentence),
      clinician: unique([...clinicianRecommendations, ...clinicianOverrides]),
      recentEvents: recentEvents.map((event) => {
        const label = `${event.service.name}${event.method === null ? "" : ` · ${event.method.name}`}`;
        const result = event.result === "abnormal" ? "Abnormal" : "Inconclusive";
        return `${label}: ${result} result recorded · ${formatVisitPrepEventDate(event.performedStart, event.datePrecision)}. No interpretation added.`;
      }),
      personalNotes:
        draft === null || draft.personalNotes.trim() === "" ? [] : [draft.personalNotes.trim()],
      sourceLinks,
      suggestedQuestions: plan.recommendations
        .filter(({ status }) =>
          ["unknown_history", "needs_date_confirmation", "discuss_with_clinician"].includes(status),
        )
        .slice(0, 4)
        .map((item) => `What should I know about ${item.service.toLowerCase()}?`),
    },
  };
}
