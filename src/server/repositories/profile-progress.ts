import type {
  HistoryAssertionState,
  OnboardingDraft,
  Prisma,
  ProfileServiceHistoryState,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";

export interface OnboardingDraftRepository {
  findForUser(userId: string): Promise<OnboardingDraft | null>;
  save(userId: string, step: number, dataJson: Prisma.InputJsonObject): Promise<OnboardingDraft>;
  clear(userId: string): Promise<void>;
}

export interface ProfileHistoryStateRepository {
  listForProfile(profileId: string): Promise<ProfileServiceHistoryState[]>;
  record(
    profileId: string,
    serviceId: string,
    state: HistoryAssertionState,
    recordedAt: Date,
    recordedByUserId: string,
  ): Promise<ProfileServiceHistoryState>;
  clear(profileId: string, serviceId: string): Promise<ProfileServiceHistoryState>;
}

export function createOnboardingDraftRepository(
  database: DatabaseClient = prisma,
): OnboardingDraftRepository {
  return {
    findForUser(userId) {
      return database.onboardingDraft.findUnique({ where: { userId } });
    },

    save(userId, step, dataJson) {
      return database.onboardingDraft.upsert({
        where: { userId },
        create: { userId, step, dataJson },
        update: { step, dataJson },
      });
    },

    async clear(userId) {
      await database.onboardingDraft.deleteMany({ where: { userId } });
    },
  };
}

export function createProfileHistoryStateRepository(
  database: DatabaseClient = prisma,
): ProfileHistoryStateRepository {
  return {
    listForProfile(profileId) {
      return database.profileServiceHistoryState.findMany({
        where: { profileId },
        orderBy: [{ serviceId: "asc" }, { recordedAt: "desc" }],
      });
    },

    record(profileId, serviceId, state, recordedAt, recordedByUserId) {
      return database.profileServiceHistoryState.upsert({
        where: { profileId_serviceId: { profileId, serviceId } },
        create: { profileId, serviceId, state, recordedAt, recordedByUserId },
        update: { state, recordedAt, recordedByUserId },
      });
    },

    clear(profileId, serviceId) {
      return database.profileServiceHistoryState.delete({
        where: { profileId_serviceId: { profileId, serviceId } },
      });
    },
  };
}

export const onboardingDraftRepository = createOnboardingDraftRepository();
export const profileHistoryStateRepository = createProfileHistoryStateRepository();
