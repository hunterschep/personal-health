import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/config/env";
import { requireProfileAccess } from "@/server/authorization/profile";
import {
  createIcs,
  customMaintenanceCalendarEvent,
  plannedActionCalendarEvent,
  recommendationCalendarEvent,
  reminderCalendarEvent,
  type CalendarEvent,
} from "@/server/calendar";
import {
  customMaintenanceVisibilityWhere,
  isProfileOwnerOrOrganizer,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const idsSchema = z.array(z.uuid()).max(200);
const itemKindSchema = z.enum(["planned", "recommendation", "reminder", "maintenance"]);

function selectedItems(url: URL): {
  explicit: boolean;
  ids: Record<z.infer<typeof itemKindSchema>, string[]>;
} {
  const ids = {
    planned: [] as string[],
    recommendation: [] as string[],
    reminder: [] as string[],
    maintenance: [] as string[],
  };
  const rawItems = z.array(z.string().max(80)).max(200).parse(url.searchParams.getAll("item"));
  for (const item of rawItems) {
    const separator = item.indexOf(":");
    const kind = itemKindSchema.parse(item.slice(0, separator));
    const id = z.uuid().parse(item.slice(separator + 1));
    ids[kind].push(id);
  }
  const hasLegacySelection = url.searchParams.has("id") || url.searchParams.has("ids");
  const legacyIds = idsSchema.parse([
    ...url.searchParams.getAll("id"),
    ...url.searchParams
      .getAll("ids")
      .flatMap((value) => value.split(","))
      .filter(Boolean),
  ]);
  ids.planned.push(...legacyIds);
  ids.recommendation.push(...legacyIds);
  return { explicit: rawItems.length > 0 || hasLegacySelection, ids };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "export");
    const url = new URL(request.url);
    const selection = selectedItems(url);
    const selected = <T extends keyof typeof selection.ids>(kind: T) =>
      selection.explicit ? selection.ids[kind] : undefined;
    const actionIds = selected("planned");
    const recommendationIds = selected("recommendation");
    const reminderIds = selected("reminder");
    const maintenanceIds = selected("maintenance");
    const canAccessOwnerOnly = isProfileOwnerOrOrganizer(profile, session.user.id);
    const [actions, recommendations, reminders, maintenance] = await Promise.all([
      prisma.plannedAction.findMany({
        where: {
          profileId: profile.id,
          status: { in: ["planned", "scheduled"] },
          ...(actionIds === undefined ? {} : { id: { in: actionIds } }),
          OR: [{ plannedMonth: { not: null } }, { appointmentStart: { not: null } }],
        },
        orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }],
        take: 200,
      }),
      prisma.recommendationInstance.findMany({
        where: {
          profileId: profile.id,
          retiredAt: null,
          dueStart: { not: null },
          status: { notIn: ["not_applicable", "not_routinely_recommended"] },
          ...(recommendationIds === undefined ? {} : { id: { in: recommendationIds } }),
        },
        orderBy: [{ dueStart: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.reminder.findMany({
        where: {
          profileId: profile.id,
          channel: "in_app",
          status: "pending",
          ...(reminderIds === undefined ? {} : { id: { in: reminderIds } }),
        },
        orderBy: [{ remindAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.customMaintenance.findMany({
        where: {
          profileId: profile.id,
          status: "active",
          nextDate: { not: null },
          ...(maintenanceIds === undefined ? {} : { id: { in: maintenanceIds } }),
          ...customMaintenanceVisibilityWhere(canAccessOwnerOnly),
        },
        orderBy: [{ nextDate: "asc" }, { id: "asc" }],
        take: 200,
      }),
    ]);
    const baseUrl = getServerEnv().APP_BASE_URL;
    const events: CalendarEvent[] = [
      ...actions.map((action) => plannedActionCalendarEvent(action, baseUrl)),
      ...recommendations.map((recommendation) =>
        recommendationCalendarEvent(recommendation, baseUrl),
      ),
      ...reminders.map((reminder) => reminderCalendarEvent(reminder, profile.timezone, baseUrl)),
      ...maintenance.map((item) => customMaintenanceCalendarEvent(item, baseUrl)),
    ]
      .filter((event): event is CalendarEvent => event !== null)
      .slice(0, 200);
    await prisma.auditLog.create({
      data: {
        householdId: profile.householdId,
        profileId: profile.id,
        actorUserId: session.user.id,
        action: "profile.calendar_exported",
        entityType: "Profile",
        entityId: profile.id,
        metadataJson: { format: "ics", itemCount: events.length },
        userAgentFamily: request.headers.get("user-agent")?.slice(0, 120) ?? null,
      },
    });
    return new NextResponse(createIcs(events), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="carecadence-care-plan.ics"',
        "Content-Type": "text/calendar; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
