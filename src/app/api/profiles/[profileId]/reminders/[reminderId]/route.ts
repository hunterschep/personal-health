import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/config/env";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("cancel_snooze") }),
  z.object({ action: z.literal("snooze"), snoozeUntil: z.iso.datetime({ offset: true }) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string; reminderId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId, reminderId } = await params;
    const { profile } = await requireProfileAccess(profileId, "edit");
    const input = updateSchema.parse(await request.json());
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, profileId: profile.id },
      include: { recommendation: true },
    });
    if (reminder === null) throw new NotFoundError();
    if (reminder.status === "sent") {
      throw new ValidationError("Sent email history cannot be changed.");
    }

    if (input.action === "snooze") {
      const now = new Date();
      const snoozeUntil = new Date(input.snoozeUntil);
      const maxDays =
        reminder.recommendation?.status === "overdue"
          ? getServerEnv().REMINDER_OVERDUE_SNOOZE_MAX_DAYS
          : 366;
      if (snoozeUntil <= now || snoozeUntil.getTime() > now.getTime() + maxDays * 86_400_000) {
        throw new ValidationError(
          reminder.recommendation?.status === "overdue"
            ? `Overdue reminders can be snoozed for up to ${maxDays} days.`
            : "Choose a snooze date within the next year.",
        );
      }
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "pending",
          remindAt: snoozeUntil,
          sentAt: null,
          snoozedFrom: reminder.snoozedFrom ?? reminder.remindAt,
          snoozedUntil: snoozeUntil,
        },
      });
    } else if (input.action === "cancel_snooze") {
      if (reminder.snoozedUntil === null) {
        throw new ValidationError("This reminder is not snoozed.");
      }
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "pending",
          remindAt: reminder.snoozedFrom ?? reminder.remindAt,
          sentAt: null,
          snoozedFrom: null,
          snoozedUntil: null,
        },
      });
    } else if (input.action === "restore") {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "pending", sentAt: null, snoozedFrom: null, snoozedUntil: null },
      });
    } else {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: input.action === "dismiss" ? "dismissed" : "cancelled",
          sentAt: null,
          snoozedFrom: null,
          snoozedUntil: null,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ profileId: string; reminderId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId, reminderId } = await context.params;
    const { profile } = await requireProfileAccess(profileId, "edit");
    const updated = await prisma.reminder.updateMany({
      where: { id: reminderId, profileId: profile.id, status: { not: "sent" } },
      data: { status: "cancelled", sentAt: null, snoozedFrom: null, snoozedUntil: null },
    });
    if (updated.count !== 1) throw new NotFoundError();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
