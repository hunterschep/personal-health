import type { Reminder, ReminderChannel, ReminderStatus } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeText } from "./normalize";

export type ReminderRecord = {
  profileId: string;
  plannedActionId: string | null;
  recommendationInstanceId: string | null;
  channel: ReminderChannel;
  remindAt: Date;
  status: Exclude<ReminderStatus, "sent">;
  dedupeKey: string;
};

export interface ReminderRepository {
  upsertPending(input: ReminderRecord): Promise<Reminder>;
  findById(id: string): Promise<Reminder | null>;
  listForProfile(profileId: string): Promise<Reminder[]>;
  listPendingThrough(through: Date, limit: number): Promise<Reminder[]>;
  markSent(id: string, sentAt: Date): Promise<Reminder>;
  setUnsentStatus(id: string, status: Exclude<ReminderStatus, "sent">): Promise<Reminder>;
}

export function createReminderRepository(database: DatabaseClient = prisma): ReminderRepository {
  return {
    upsertPending(input) {
      const dedupeKey = normalizeText(input.dedupeKey);
      const data = {
        plannedActionId: input.plannedActionId,
        recommendationInstanceId: input.recommendationInstanceId,
        remindAt: input.remindAt,
        status: input.status,
        sentAt: null,
      };

      return database.reminder.upsert({
        where: {
          profileId_channel_dedupeKey: {
            profileId: input.profileId,
            channel: input.channel,
            dedupeKey,
          },
        },
        create: {
          profileId: input.profileId,
          channel: input.channel,
          dedupeKey,
          ...data,
        },
        update: data,
      });
    },

    findById(id) {
      return database.reminder.findUnique({ where: { id } });
    },

    listForProfile(profileId) {
      return database.reminder.findMany({
        where: { profileId },
        orderBy: [{ status: "asc" }, { remindAt: "asc" }, { id: "asc" }],
      });
    },

    listPendingThrough(through, limit) {
      return database.reminder.findMany({
        where: { status: "pending", remindAt: { lte: through } },
        orderBy: [{ remindAt: "asc" }, { id: "asc" }],
        take: limit,
      });
    },

    markSent(id, sentAt) {
      return database.reminder.update({
        where: { id },
        data: { status: "sent", sentAt },
      });
    },

    setUnsentStatus(id, status) {
      return database.reminder.update({ where: { id }, data: { status, sentAt: null } });
    },
  };
}

export const reminderRepository = createReminderRepository();
