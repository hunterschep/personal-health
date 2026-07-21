import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";

import {
  plannedActionReminderCopy,
  recommendationReminderCopy,
  standaloneReminderCopy,
} from "./copy";
import { configuredReminderMailer, type ReminderMailer } from "./email";
import { signReminderLink } from "./links";
import { localDateKey, localDateTimeParts } from "./timezone";

export type ReminderDispatchResult = {
  scanned: number;
  sentIds: string[];
  failedIds: string[];
  skippedIds: string[];
  dryRun: boolean;
  unavailable: boolean;
};

type DispatchOptions = {
  now?: Date;
  batchSize?: number;
  dryRun?: boolean;
  mailer?: ReminderMailer;
  baseUrl?: string;
};

const dispatchReminderInclude = {
  profile: { include: { owner: true, reminderPreferences: true } },
  recommendation: { include: { service: true, activeOverride: true } },
  plannedAction: true,
} satisfies Prisma.ReminderInclude;

type DispatchReminder = Prisma.ReminderGetPayload<{
  include: typeof dispatchReminderInclude;
}>;

function emailText(reminder: DispatchReminder): string {
  return reminder.recommendation !== null
    ? recommendationReminderCopy(
        reminder.recommendation.recommendationClass,
        reminder.recommendation.status,
        reminder.recommendation.service.shortName,
        reminder.recommendation.activeOverride?.reason,
      ).emailText
    : reminder.plannedAction !== null
      ? plannedActionReminderCopy(reminder.plannedAction.appointmentStart !== null).emailText
      : standaloneReminderCopy(reminder.dedupeKey).emailText;
}

function digestWindowIsOpen(
  mode: "daily" | "weekly",
  now: Date,
  timezone: string,
  lastDigestSentAt: Date | null,
): boolean {
  const local = localDateTimeParts(now, timezone);
  if (mode === "weekly" && local.weekday !== 1) return false;
  return (
    lastDigestSentAt === null ||
    localDateKey(lastDigestSentAt, timezone) !== localDateKey(now, timezone)
  );
}

function transient(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: unknown; responseCode?: unknown };
  const transientCodes = new Set([
    "ETIMEDOUT",
    "ECONNECTION",
    "ECONNRESET",
    "EAI_AGAIN",
    "ESOCKET",
  ]);
  return (
    (typeof value.code === "string" && transientCodes.has(value.code)) ||
    (typeof value.responseCode === "number" &&
      value.responseCode >= 400 &&
      value.responseCode < 500)
  );
}

async function retrySend(mailer: ReminderMailer, message: Parameters<ReminderMailer["send"]>[0]) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await mailer.send(message);
      return;
    } catch (error) {
      lastError = error;
      if (!transient(error)) break;
    }
  }
  throw lastError;
}

export async function dispatchDueReminders(
  options: DispatchOptions = {},
): Promise<ReminderDispatchResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 50;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
    throw new RangeError("Reminder dispatch batch size must be between 1 and 200.");
  }
  const dryRun = options.dryRun ?? false;
  const mailer = options.mailer ?? configuredReminderMailer();
  if (mailer === null) {
    return {
      scanned: 0,
      sentIds: [],
      failedIds: [],
      skippedIds: [],
      dryRun,
      unavailable: true,
    };
  }
  const baseUrl = options.baseUrl ?? process.env.APP_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim() === "") {
    throw new Error("APP_BASE_URL is required for signed reminder email links.");
  }

  const candidates = await prisma.reminder.findMany({
    where: {
      channel: "email",
      status: "pending",
      remindAt: { lte: now },
      profile: { deletedAt: null },
    },
    select: { id: true },
    orderBy: [{ remindAt: "asc" }, { id: "asc" }],
    take: batchSize,
  });
  if (dryRun) {
    return {
      scanned: candidates.length,
      sentIds: [],
      failedIds: [],
      skippedIds: candidates.map(({ id }) => id),
      dryRun: true,
      unavailable: false,
    };
  }
  try {
    await mailer.verify();
  } catch {
    return {
      scanned: candidates.length,
      sentIds: [],
      failedIds: candidates.map(({ id }) => id),
      skippedIds: [],
      dryRun: false,
      unavailable: true,
    };
  }

  const sentIds: string[] = [];
  const failedIds: string[] = [];
  const skippedIds: string[] = [];
  const candidateIds = candidates.map(({ id }) => id);
  const processedIds = new Set<string>();
  for (const candidate of candidates) {
    if (processedIds.has(candidate.id)) continue;
    try {
      const outcome = await prisma.$transaction(
        async (database) => {
          const lock = await database.$queryRaw<{ locked: boolean }[]>(
            Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${candidate.id}, 0)) AS "locked"`,
          );
          if (lock[0]?.locked !== true) return { kind: "skipped" as const, ids: [candidate.id] };
          const reminder = await database.reminder.findFirst({
            where: {
              id: candidate.id,
              channel: "email",
              status: "pending",
              remindAt: { lte: now },
              profile: { deletedAt: null },
            },
            include: dispatchReminderInclude,
          });
          if (reminder === null) return { kind: "skipped" as const, ids: [candidate.id] };
          const owner = reminder.profile.owner;
          if (reminder.profile.deletedAt !== null || owner === null || owner.deletedAt !== null)
            return { kind: "skipped" as const, ids: [candidate.id] };
          const preference = reminder.profile.reminderPreferences.find(
            (item) => item.userId === owner.id,
          );
          if (preference?.emailEnabled !== true)
            return { kind: "skipped" as const, ids: [candidate.id] };
          const digestMode = preference.digestMode ?? "individual";

          let reminders: DispatchReminder[] = [reminder];
          if (digestMode !== "individual") {
            const digestLock = await database.$queryRaw<{ locked: boolean }[]>(
              Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`reminder-digest:${reminder.profileId}`}, 0)) AS "locked"`,
            );
            if (digestLock[0]?.locked !== true) {
              return { kind: "skipped" as const, ids: [candidate.id] };
            }
            if (
              !digestWindowIsOpen(digestMode, now, preference.timezone, preference.lastDigestSentAt)
            ) {
              return { kind: "skipped" as const, ids: [candidate.id] };
            }
            reminders = await database.reminder.findMany({
              where: {
                id: { in: candidateIds },
                profileId: reminder.profileId,
                channel: "email",
                status: "pending",
                remindAt: { lte: now },
                profile: { deletedAt: null },
              },
              include: dispatchReminderInclude,
              orderBy: [{ remindAt: "asc" }, { id: "asc" }],
            });
            if (reminders.length === 0) return { kind: "skipped" as const, ids: [candidate.id] };
          }

          const token = await signReminderLink(owner.id, reminders[0]!.id);
          const deepLink = new URL(
            `/api/reminders/link?token=${encodeURIComponent(token)}`,
            baseUrl,
          );
          const text =
            digestMode === "individual"
              ? emailText(reminder)
              : `${digestMode === "weekly" ? "Weekly" : "Daily"} CareCadence reminder digest:\n\n${reminders
                  .map((item, index) => `${index + 1}. ${emailText(item)}`)
                  .join("\n\n")}`;
          await retrySend(mailer, {
            to: owner.email,
            text,
            deepLink: deepLink.toString(),
          });
          const updated = await database.reminder.updateMany({
            where: { id: { in: reminders.map(({ id }) => id) }, status: "pending" },
            data: { status: "sent", sentAt: now },
          });
          const ids = reminders.map(({ id }) => id);
          if (updated.count !== ids.length) return { kind: "skipped" as const, ids };
          if (digestMode !== "individual") {
            await database.reminderPreference.update({
              where: { id: preference.id },
              data: { lastDigestSentAt: now },
            });
          }
          return { kind: "sent" as const, ids };
        },
        { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 45_000 },
      );
      outcome.ids.forEach((id) => processedIds.add(id));
      (outcome.kind === "sent" ? sentIds : skippedIds).push(...outcome.ids);
    } catch {
      failedIds.push(candidate.id);
    }
  }
  return {
    scanned: candidates.length,
    sentIds,
    failedIds,
    skippedIds,
    dryRun: false,
    unavailable: false,
  };
}
