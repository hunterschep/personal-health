import { NextResponse } from "next/server";
import { z } from "zod";

import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import {
  plannedActionReminderCopy,
  recommendationReminderCopy,
  smtpDeliveryStatus,
  smtpSettings,
  standaloneReminderCopy,
} from "@/server/reminders";

const createSchema = z
  .object({
    recommendationInstanceId: z.uuid().nullable().default(null),
    plannedActionId: z.uuid().nullable().default(null),
    channel: z.enum(["in_app", "email"]).default("in_app"),
    remindAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (value) =>
      Number(value.recommendationInstanceId !== null) + Number(value.plannedActionId !== null) ===
      1,
    { message: "Choose one recommendation or planned action." },
  );

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile, session, capabilities } = await requireProfileAccess(profileId, "view");
    const now = new Date();
    const preference = await prisma.reminderPreference.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
    });
    const channels = [
      ...(preference?.inAppEnabled === false ? [] : (["in_app"] as const)),
      ...(profile.ownerUserId === session.user.id ? (["email"] as const) : []),
    ];
    const reminders =
      channels.length === 0
        ? []
        : await prisma.reminder.findMany({
            where: { profileId: profile.id, channel: { in: channels } },
            include: {
              recommendation: { include: { service: true, activeOverride: true } },
              plannedAction: true,
            },
            orderBy: [{ status: "asc" }, { remindAt: "asc" }, { id: "asc" }],
            take: 500,
          });
    return NextResponse.json(
      {
        editable: capabilities.canEdit,
        smtpAvailable: smtpSettings() !== null && smtpDeliveryStatus().status === "ready",
        smtpStatus: smtpDeliveryStatus().status,
        reminders: reminders.map((reminder) => {
          const copy =
            reminder.recommendation !== null
              ? recommendationReminderCopy(
                  reminder.recommendation.recommendationClass,
                  reminder.recommendation.status,
                  reminder.recommendation.service.shortName,
                  reminder.recommendation.activeOverride?.reason,
                )
              : reminder.plannedAction !== null
                ? plannedActionReminderCopy(reminder.plannedAction.appointmentStart !== null)
                : standaloneReminderCopy(reminder.dedupeKey);
          const activelySnoozed = reminder.snoozedUntil !== null && reminder.snoozedUntil > now;
          return {
            id: reminder.id,
            title: copy.title,
            detail: copy.detail,
            remindAt: reminder.remindAt,
            channel: reminder.channel,
            status: reminder.status,
            snoozedUntil: activelySnoozed ? reminder.snoozedUntil : null,
            section:
              reminder.status === "dismissed" || reminder.status === "cancelled"
                ? "dismissed"
                : reminder.status === "sent"
                  ? "sent"
                  : activelySnoozed
                    ? "snoozed"
                    : reminder.remindAt <= now
                      ? "today"
                      : "upcoming",
          };
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "edit");
    const input = createSchema.parse(await request.json());
    const remindAt = new Date(input.remindAt);
    const furthest = new Date();
    furthest.setUTCFullYear(furthest.getUTCFullYear() + 10);
    if (remindAt > furthest)
      throw new ValidationError("Reminders can be planned up to ten years ahead.");

    let entityKey: string;
    if (input.recommendationInstanceId !== null) {
      const recommendation = await prisma.recommendationInstance.findFirst({
        where: {
          id: input.recommendationInstanceId,
          profileId: profile.id,
          retiredAt: null,
        },
      });
      if (recommendation === null) throw new ValidationError("Choose an active care plan item.");
      if (
        recommendation.status === "not_applicable" ||
        recommendation.status === "not_routinely_recommended" ||
        recommendation.recommendationClass === "not_recommended"
      ) {
        throw new ValidationError("Reminders are not available for this care plan item.");
      }
      entityKey = `recommendation:${recommendation.id}`;
    } else {
      const action = await prisma.plannedAction.findFirst({
        where: { id: input.plannedActionId ?? "", profileId: profile.id },
      });
      if (action === null) throw new ValidationError("Choose a planned action for this profile.");
      entityKey = `planned-action:${action.id}`;
    }
    const preference = await prisma.reminderPreference.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
      select: { inAppEnabled: true, emailEnabled: true },
    });
    if (input.channel === "in_app" && preference?.inAppEnabled === false) {
      throw new ValidationError("Enable in-app reminders in profile preferences first.");
    }
    if (input.channel === "email") {
      if (smtpSettings() === null) throw new ValidationError("Email reminders are not configured.");
      const smtpStatus = smtpDeliveryStatus().status;
      if (smtpStatus === "unavailable") {
        throw new ValidationError(
          "Email delivery verification failed. In-app reminders remain available.",
        );
      }
      if (smtpStatus !== "ready") {
        throw new ValidationError("Email delivery verification is still in progress.");
      }
      if (profile.ownerUserId !== session.user.id) {
        throw new ValidationError("Only the profile owner can enable email reminders.");
      }
      if (preference?.emailEnabled !== true) {
        throw new ValidationError("Enable email reminders in profile preferences first.");
      }
    }

    const dedupeKey = `${entityKey}:user:${remindAt.toISOString()}`;
    const reminder = await prisma.reminder.upsert({
      where: {
        profileId_channel_dedupeKey: {
          profileId: profile.id,
          channel: input.channel,
          dedupeKey,
        },
      },
      create: {
        profileId: profile.id,
        recommendationInstanceId: input.recommendationInstanceId,
        plannedActionId: input.plannedActionId,
        channel: input.channel,
        remindAt,
        dedupeKey,
      },
      update: {},
    });
    return NextResponse.json({ ok: true, reminderId: reminder.id }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
