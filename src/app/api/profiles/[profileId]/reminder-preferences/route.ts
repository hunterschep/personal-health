import { NextResponse } from "next/server";
import { z } from "zod";

import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { smtpDeliveryStatus, smtpSettings } from "@/server/reminders";

const quietTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const preferenceSchema = z
  .object({
    inAppEnabled: z.boolean().default(true),
    emailEnabled: z.boolean().default(false),
    unknownHistoryPrompts: z.boolean().default(true),
    quietDays: z.array(z.number().int().min(0).max(6)).max(6).default([]),
    quietHoursStart: quietTimeSchema.nullable().default(null),
    quietHoursEnd: quietTimeSchema.nullable().default(null),
    dueSoonWindowDays: z.number().int().min(7).max(365).default(90),
    householdActivityDetail: z.boolean().default(false),
    timezone: z.string().trim().min(1).max(80),
    digestMode: z.enum(["individual", "daily", "weekly"]).default("individual"),
  })
  .refine((value) => (value.quietHoursStart === null) === (value.quietHoursEnd === null), {
    message: "Set both quiet-hour times or leave both empty.",
  });

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function response(
  profile: { timezone: string; ownerUserId: string | null },
  userId: string,
  editable: boolean,
  preference: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    unknownHistoryPrompts: boolean;
    quietDaysJson: unknown;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    dueSoonWindowDays: number;
    householdActivityDetail: boolean;
    timezone: string;
    digestMode: "individual" | "daily" | "weekly";
  } | null,
) {
  const smtpStatus = smtpDeliveryStatus().status;
  return {
    editable,
    smtpAvailable: smtpSettings() !== null && smtpStatus === "ready",
    smtpStatus,
    emailOwnerControlled: true,
    canManageEmail: profile.ownerUserId === userId,
    preferences: {
      inAppEnabled: preference?.inAppEnabled ?? true,
      emailEnabled: preference?.emailEnabled ?? false,
      unknownHistoryPrompts: preference?.unknownHistoryPrompts ?? true,
      quietDays: Array.isArray(preference?.quietDaysJson) ? preference.quietDaysJson : [],
      quietHoursStart: preference?.quietHoursStart ?? null,
      quietHoursEnd: preference?.quietHoursEnd ?? null,
      dueSoonWindowDays: preference?.dueSoonWindowDays ?? 90,
      householdActivityDetail: preference?.householdActivityDetail ?? false,
      timezone: preference?.timezone ?? profile.timezone,
      digestMode: preference?.digestMode ?? "individual",
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile, session, capabilities } = await requireProfileAccess(profileId, "view");
    const preference = await prisma.reminderPreference.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
    });
    return NextResponse.json(response(profile, session.user.id, capabilities.canEdit, preference), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile, session, capabilities } = await requireProfileAccess(profileId, "edit");
    const input = preferenceSchema.parse(await request.json());
    if (!validTimezone(input.timezone)) throw new ValidationError("Choose a valid IANA timezone.");
    if (input.emailEnabled) {
      if (profile.ownerUserId !== session.user.id) {
        throw new ValidationError("Only the profile owner can enable email reminders.");
      }
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
    }
    const preference = await prisma.reminderPreference.upsert({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
      create: {
        userId: session.user.id,
        profileId: profile.id,
        inAppEnabled: input.inAppEnabled,
        emailEnabled: input.emailEnabled,
        unknownHistoryPrompts: input.unknownHistoryPrompts,
        quietDaysJson: input.quietDays,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        dueSoonWindowDays: input.dueSoonWindowDays,
        householdActivityDetail: input.householdActivityDetail,
        timezone: input.timezone,
        digestMode: input.digestMode,
      },
      update: {
        inAppEnabled: input.inAppEnabled,
        emailEnabled: input.emailEnabled,
        unknownHistoryPrompts: input.unknownHistoryPrompts,
        quietDaysJson: input.quietDays,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        dueSoonWindowDays: input.dueSoonWindowDays,
        householdActivityDetail: input.householdActivityDetail,
        timezone: input.timezone,
        digestMode: input.digestMode,
      },
    });
    if (!input.emailEnabled && profile.ownerUserId === session.user.id) {
      await prisma.reminder.deleteMany({
        where: { profileId: profile.id, channel: "email", status: "pending" },
      });
    }
    return NextResponse.json({
      ok: true,
      ...response(profile, session.user.id, capabilities.canEdit, preference),
    });
  } catch (error) {
    return routeError(error);
  }
}
