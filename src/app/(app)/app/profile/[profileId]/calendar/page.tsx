import { Download } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { AnnualRoadmap, type RoadmapPlan } from "@/components/planning/annual-roadmap";
import { recommendationRoadmapPlacement } from "@/components/planning/roadmap-placement";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dateInTimeZone } from "@/domain/dates";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { formatLocalWallTime, localYearMonth } from "@/server/calendar/local-time";
import {
  customMaintenanceVisibilityWhere,
  isProfileOwnerOrOrganizer,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { displayDateRange } from "@/server/read-models";

type CalendarSearchParams = { plan?: string | string[] };

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<CalendarSearchParams>;
}) {
  const [{ profileId }, filters] = await Promise.all([params, searchParams]);
  const { session, profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const canAccessOwnerOnly = isProfileOwnerOrOrganizer(profile, session.user.id);
  const [yearText, monthText] = dateInTimeZone(new Date(), profile.timezone).split("-");
  const year = Number(yearText);
  const currentMonth = Number(monthText) - 1;
  const [actions, recommendations, reminders, customMaintenance] = await Promise.all([
    prisma.plannedAction.findMany({
      where: { profileId: profile.id, status: { in: ["planned", "scheduled"] } },
      include: {
        reminders: {
          where: {
            channel: "in_app",
            status: "pending",
            dedupeKey: { contains: ":appointment:" },
          },
          select: { dedupeKey: true },
          take: 1,
        },
      },
      orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }],
    }),
    prisma.recommendationInstance.findMany({
      where: {
        profileId: profile.id,
        retiredAt: null,
        status: {
          in: [
            "overdue",
            "due_now",
            "due_soon",
            "due_this_year",
            "needs_date_confirmation",
            "future",
          ],
        },
      },
      include: { service: true },
      orderBy: [{ dueStart: "asc" }, { service: { sortOrder: "asc" } }],
    }),
    prisma.reminder.findMany({
      where: { profileId: profile.id, channel: "in_app", status: "pending" },
      include: {
        plannedAction: { select: { title: true, status: true } },
        recommendation: {
          select: { retiredAt: true, service: { select: { name: true } } },
        },
      },
      orderBy: { remindAt: "asc" },
    }),
    prisma.customMaintenance.findMany({
      where: {
        profileId: profile.id,
        status: "active",
        nextDate: { not: null },
        ...customMaintenanceVisibilityWhere(canAccessOwnerOnly),
      },
      select: { id: true, title: true, nextDate: true },
      orderBy: [{ nextDate: "asc" }, { title: "asc" }],
    }),
  ]);

  const visibleActions = actions.filter((action) => {
    if (action.appointmentStart !== null) {
      return localYearMonth(action.appointmentStart, profile.timezone).year === year;
    }
    return action.plannedMonth === null || action.plannedMonth.getUTCFullYear() === year;
  });
  const plannedRecommendationIds = new Set(
    visibleActions
      .map(({ recommendationInstanceId }) => recommendationInstanceId)
      .filter((id): id is string => id !== null),
  );
  const visibleRecommendations = recommendations;
  const visibleReminders = reminders.filter((reminder) => {
    if (localYearMonth(reminder.remindAt, profile.timezone).year !== year) return false;
    if (
      reminder.plannedAction !== null &&
      reminder.plannedAction.status !== "planned" &&
      reminder.plannedAction.status !== "scheduled"
    ) {
      return false;
    }
    return reminder.recommendation?.retiredAt === null || reminder.recommendation === null;
  });
  const visibleCustomMaintenance = customMaintenance.filter(
    (item): item is typeof item & { nextDate: Date } =>
      item.nextDate !== null && item.nextDate.getUTCFullYear() === year,
  );
  const plans: RoadmapPlan[] = [
    ...visibleActions.map((action) => {
      const appointmentCalendar =
        action.appointmentStart === null
          ? null
          : localYearMonth(action.appointmentStart, profile.timezone);
      const appointmentStartLocal =
        action.appointmentStart === null
          ? null
          : formatLocalWallTime(action.appointmentStart, profile.timezone);
      const appointmentEndLocal =
        action.appointmentEnd === null
          ? null
          : formatLocalWallTime(action.appointmentEnd, profile.timezone);
      return {
        id: action.id,
        title: action.title,
        month: appointmentCalendar?.month ?? action.plannedMonth?.getUTCMonth() ?? null,
        bucket:
          appointmentCalendar === null && action.plannedMonth === null ? ("future" as const) : null,
        status: action.appointmentStart === null ? ("planned" as const) : ("appointment" as const),
        timing:
          action.appointmentStart?.toLocaleString("en-US", {
            timeZone: profile.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }) ??
          (action.plannedMonth === null
            ? "Planned"
            : `Planned for ${action.plannedMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}`),
        serviceId: action.serviceId,
        recommendationId: action.recommendationInstanceId,
        persisted: true,
        startDate: appointmentStartLocal?.slice(0, 10) ?? null,
        endDate: appointmentEndLocal?.slice(0, 10) ?? null,
        appointmentStartLocal,
        appointmentEndLocal,
        reminderDaysBefore: (() => {
          const match = /:days-before:(\d+)$/.exec(action.reminders[0]?.dedupeKey ?? "");
          return match === null ? null : Number(match[1]);
        })(),
        location: action.location,
        notes: action.notes,
        detailHref: null,
      };
    }),
    ...visibleRecommendations
      .filter((recommendation) => !plannedRecommendationIds.has(recommendation.id))
      .map((recommendation) => {
        const placement = recommendationRoadmapPlacement(
          recommendation.status,
          recommendation.dueStart,
          year,
        );
        return {
          id: `recommendation-${recommendation.id}`,
          title: recommendation.service.name,
          ...placement,
          status: "medical" as const,
          timing: displayDateRange(recommendation.dueStart, recommendation.dueEnd),
          serviceId: recommendation.serviceId,
          recommendationId: recommendation.id,
          persisted: false,
          startDate: recommendation.dueStart?.toISOString().slice(0, 10) ?? null,
          endDate: recommendation.dueEnd?.toISOString().slice(0, 10) ?? null,
          appointmentStartLocal: null,
          appointmentEndLocal: null,
          reminderDaysBefore: null,
          location: null,
          notes: null,
          detailHref: `/app/profile/${profile.id}/care-plan/${recommendation.id}`,
        };
      }),
    ...visibleReminders.map((reminder) => {
      const calendar = localYearMonth(reminder.remindAt, profile.timezone);
      const localWallTime = formatLocalWallTime(reminder.remindAt, profile.timezone);
      const relatedTitle =
        reminder.plannedAction?.title ?? reminder.recommendation?.service.name ?? "Care follow-up";
      return {
        id: `reminder-${reminder.id}`,
        title: `${relatedTitle} reminder`,
        month: calendar.month,
        bucket: null,
        status: "reminder" as const,
        timing: `Reminder set for ${reminder.remindAt.toLocaleString("en-US", {
          timeZone: profile.timezone,
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
        serviceId: null,
        recommendationId: null,
        persisted: false,
        startDate: localWallTime.slice(0, 10),
        endDate: null,
        appointmentStartLocal: null,
        appointmentEndLocal: null,
        reminderDaysBefore: null,
        location: null,
        notes: null,
        detailHref: "/app/reminders",
      };
    }),
    ...visibleCustomMaintenance.map((item) => ({
      id: `maintenance-${item.id}`,
      title: item.title,
      month: item.nextDate.getUTCMonth(),
      bucket: null,
      status: "maintenance" as const,
      timing: `${displayDateRange(item.nextDate, item.nextDate)} · Personal cadence, not a guideline deadline`,
      serviceId: null,
      recommendationId: null,
      persisted: false,
      startDate: item.nextDate.toISOString().slice(0, 10),
      endDate: null,
      appointmentStartLocal: null,
      appointmentEndLocal: null,
      reminderDaysBefore: null,
      location: null,
      notes: null,
      detailHref: `/app/profile/${profile.id}/maintenance`,
    })),
  ];
  const requestedPlan =
    typeof filters.plan === "string" && z.uuid().safeParse(filters.plan).success
      ? filters.plan
      : null;
  const initialSelectedId =
    requestedPlan === null
      ? undefined
      : plans.find((plan) => plan.id === requestedPlan || plan.recommendationId === requestedPlan)
          ?.id;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Annual roadmap"
        title={`${profile.displayName}'s calendar`}
        description="Medical due windows, plans, appointments, reminders, and chosen personal cadences use distinct labels and shapes."
        actions={
          capabilities.canExport ? (
            <Button variant="secondary" asChild>
              <Link prefetch={false} href={`/api/profiles/${profile.id}/calendar.ics`}>
                <Download aria-hidden="true" /> Export all
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Alert tone="info" title="Planning is separate from medical timing">
        Choosing a month or adding an appointment never changes when a source-backed recommendation
        is due.
      </Alert>
      <AnnualRoadmap
        profileId={profile.id}
        timezone={profile.timezone}
        year={year}
        currentMonth={currentMonth}
        initialPlans={plans}
        {...(initialSelectedId === undefined ? {} : { initialSelectedId })}
        editable={capabilities.canEdit}
        exportable={capabilities.canExport}
      />
    </div>
  );
}
