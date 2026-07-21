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

const actionSchema = z.object({
  recommendationInstanceId: z.uuid().nullable(),
  serviceId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  plannedMonth: z.iso.date(),
  appointmentStart: localWallTimeSchema.nullable(),
  appointmentEnd: localWallTimeSchema.nullable(),
  reminderDaysBefore: z.number().int().min(0).max(365).nullable().optional().default(null),
  location: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = actionSchema.parse(await request.json());
    const appointmentStart =
      input.appointmentStart === null
        ? null
        : parseLocalWallTime(input.appointmentStart, profile.timezone);
    const appointmentEnd =
      input.appointmentEnd === null
        ? null
        : parseLocalWallTime(input.appointmentEnd, profile.timezone);
    assertAppointmentRange(appointmentStart, appointmentEnd);
    if (input.reminderDaysBefore !== null && appointmentStart === null) {
      throw new ValidationError("Add an appointment before choosing its reminder timing.");
    }
    const preference =
      input.reminderDaysBefore === null
        ? null
        : await prisma.reminderPreference.findUnique({
            where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
            select: {
              inAppEnabled: true,
              quietDaysJson: true,
              quietHoursStart: true,
              quietHoursEnd: true,
              timezone: true,
            },
          });
    if (input.reminderDaysBefore !== null) {
      if (preference?.inAppEnabled === false) {
        throw new ValidationError("Enable in-app reminders before adding an appointment reminder.");
      }
    }
    const service = await prisma.serviceCatalog.findFirst({
      where: { id: input.serviceId, active: true },
    });
    if (service === null) throw new NotFoundError();
    if (input.recommendationInstanceId !== null) {
      const recommendation = await prisma.recommendationInstance.findFirst({
        where: {
          id: input.recommendationInstanceId,
          profileId: profile.id,
          serviceId: service.id,
          retiredAt: null,
        },
      });
      if (recommendation === null) throw new NotFoundError();
    }
    const created = await prisma.$transaction(async (database) => {
      const action = await database.plannedAction.create({
        data: {
          profileId: profile.id,
          recommendationInstanceId: input.recommendationInstanceId,
          serviceId: service.id,
          title: input.title,
          plannedMonth: dateOnly(input.plannedMonth),
          appointmentStart,
          appointmentEnd,
          timezone: profile.timezone,
          location: optionalText(input.location),
          notes: optionalText(input.notes),
          status: appointmentStart === null ? "planned" : "scheduled",
          createdByUserId: session.user.id,
        },
      });
      if (input.reminderDaysBefore !== null) {
        const candidate = plannedActionCandidate(
          action,
          profile.timezone,
          input.reminderDaysBefore,
        );
        if (candidate !== null) {
          await database.reminder.create({
            data: {
              ...candidate,
              remindAt: applyQuietTime(
                candidate.remindAt,
                reminderSchedulingPreferences(preference, profile.timezone),
              ),
            },
          });
        }
      }
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "planned_action.created",
          entityType: "PlannedAction",
          entityId: action.id,
          metadataJson: {},
        },
      });
      return action;
    });
    return NextResponse.json(
      { ok: true, action: created, reminderDaysBefore: input.reminderDaysBefore },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
