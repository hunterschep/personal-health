import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { assertAppointmentRange, parseLocalWallTime } from "@/server/calendar/local-time";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import {
  applyQuietTime,
  plannedActionCandidate,
  reminderSchedulingPreferences,
} from "@/server/reminders";

const localWallTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid local date and time.");

const updateSchema = z
  .object({
    plannedMonth: z.iso.date().optional(),
    appointmentStart: localWallTimeSchema.nullable().optional(),
    appointmentEnd: localWallTimeSchema.nullable().optional(),
    reminderDaysBefore: z.number().int().min(0).max(365).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update.");

type Context = { params: Promise<{ profileId: string; actionId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, actionId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = updateSchema.parse(await request.json());
    const appointmentStart =
      input.appointmentStart === undefined || input.appointmentStart === null
        ? input.appointmentStart
        : parseLocalWallTime(input.appointmentStart, profile.timezone);
    const appointmentEnd =
      input.appointmentEnd === undefined || input.appointmentEnd === null
        ? input.appointmentEnd
        : parseLocalWallTime(input.appointmentEnd, profile.timezone);
    const preference = await prisma.reminderPreference.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
      select: {
        inAppEnabled: true,
        quietDaysJson: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        timezone: true,
      },
    });
    if (input.reminderDaysBefore !== undefined && input.reminderDaysBefore !== null) {
      if (preference?.inAppEnabled === false) {
        throw new ValidationError("Enable in-app reminders before adding an appointment reminder.");
      }
    }
    const action = await prisma.$transaction(async (database) => {
      const existing = await database.plannedAction.findFirst({
        where: { id: actionId, profileId: profile.id, status: { in: ["planned", "scheduled"] } },
      });
      if (existing === null) throw new NotFoundError();
      const nextAppointmentStart =
        appointmentStart === undefined ? existing.appointmentStart : appointmentStart;
      const nextAppointmentEnd =
        appointmentEnd === undefined ? existing.appointmentEnd : appointmentEnd;
      assertAppointmentRange(nextAppointmentStart, nextAppointmentEnd);
      if (
        input.reminderDaysBefore !== undefined &&
        input.reminderDaysBefore !== null &&
        nextAppointmentStart === null
      ) {
        throw new ValidationError("Add an appointment before choosing its reminder timing.");
      }
      const appointmentChanged = appointmentStart !== undefined || appointmentEnd !== undefined;
      const reminderSelectionChanged = input.reminderDaysBefore !== undefined;
      const rescheduleReminders = appointmentStart !== undefined || reminderSelectionChanged;
      const existingReminderOffsets = rescheduleReminders
        ? await database.reminder.findMany({
            where: {
              profileId: profile.id,
              plannedActionId: existing.id,
              channel: "in_app",
              status: "pending",
              dedupeKey: { startsWith: `planned-action:${existing.id}:appointment:` },
            },
            select: { dedupeKey: true },
          })
        : [];
      const reminderOffsets =
        nextAppointmentStart === null || preference?.inAppEnabled === false
          ? []
          : input.reminderDaysBefore === undefined
            ? existingReminderOffsets.flatMap(({ dedupeKey }) => {
                const match = /:days-before:(\d+)$/.exec(dedupeKey);
                return match === null ? [] : [Number(match[1])];
              })
            : input.reminderDaysBefore === null
              ? []
              : [input.reminderDaysBefore];
      const updated = await database.plannedAction.update({
        where: { id: existing.id },
        data: {
          ...(input.plannedMonth === undefined
            ? {}
            : { plannedMonth: dateOnly(input.plannedMonth) }),
          ...(appointmentStart === undefined ? {} : { appointmentStart }),
          ...(appointmentEnd === undefined ? {} : { appointmentEnd }),
          ...(input.location === undefined ? {} : { location: optionalText(input.location) }),
          ...(input.notes === undefined ? {} : { notes: optionalText(input.notes) }),
          ...(appointmentChanged
            ? {
                timezone: profile.timezone,
                status:
                  nextAppointmentStart === null ? ("planned" as const) : ("scheduled" as const),
              }
            : {}),
        },
      });
      if (rescheduleReminders) {
        await database.reminder.deleteMany({
          where: {
            profileId: profile.id,
            plannedActionId: existing.id,
            channel: "in_app",
            status: "pending",
            dedupeKey: { startsWith: `planned-action:${existing.id}:appointment:` },
          },
        });
        const candidates = reminderOffsets.flatMap((daysBefore) => {
          const candidate = plannedActionCandidate(updated, profile.timezone, daysBefore);
          return candidate === null
            ? []
            : [
                {
                  ...candidate,
                  remindAt: applyQuietTime(
                    candidate.remindAt,
                    reminderSchedulingPreferences(preference, profile.timezone),
                  ),
                },
              ];
        });
        if (candidates.length > 0) {
          await database.reminder.createMany({ data: candidates, skipDuplicates: true });
        }
      }
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "planned_action.updated",
          entityType: "PlannedAction",
          entityId: updated.id,
          metadataJson: {},
        },
      });
      return updated;
    });
    return NextResponse.json({ ok: true, action, reminderDaysBefore: input.reminderDaysBefore });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, actionId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    await prisma.$transaction(async (database) => {
      const result = await database.plannedAction.updateMany({
        where: { id: actionId, profileId: profile.id, status: { in: ["planned", "scheduled"] } },
        data: { status: "cancelled" },
      });
      if (result.count !== 1) throw new NotFoundError();
      await database.reminder.updateMany({
        where: { plannedActionId: actionId, status: "pending" },
        data: { status: "cancelled" },
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "planned_action.cancelled",
          entityType: "PlannedAction",
          entityId: actionId,
          metadataJson: {},
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
