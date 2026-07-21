import { ConflictError, NotFoundError } from "@/domain/shared/errors";
import type {
  AnatomyKey,
  AnatomyState,
  CareEvent,
  ClinicianOverride,
  Profile,
  ProfileAnatomy,
  ProfileVisibility,
  RiskFactor,
  Surgery,
} from "@/generated/prisma/client";
import { createCareEventRepository, type CareEventRecord } from "@/server/repositories/care-event";
import {
  createClinicianOverrideRepository,
  type ClinicianOverrideRecord,
} from "@/server/repositories/clinician-override";
import {
  createHealthContextRepository,
  type CreateSurgeryRecord,
  type SetAnatomyRecord,
} from "@/server/repositories/health-context";
import { normalizeEmail } from "@/server/repositories/normalize";
import { createProfileRepository, type CreateProfileRecord } from "@/server/repositories/profile";

import {
  withSerializableTransaction,
  withTransaction,
  type TransactionClient,
} from "./transactions";

export type RecommendationRebuilder = (
  transaction: TransactionClient,
  profileId: string,
) => Promise<void>;

export type CreateProfileWithAnatomyInput = {
  profile: CreateProfileRecord;
  anatomy: Array<{
    anatomyKey: AnatomyKey;
    state: AnatomyState;
    effectiveDate: Date | null;
    note: string | null;
  }>;
};

export async function createProfileWithAnatomy(
  input: CreateProfileWithAnatomyInput,
): Promise<{ profile: Profile; anatomy: ProfileAnatomy[] }> {
  return withTransaction(async (transaction) => {
    const profiles = createProfileRepository(transaction);
    const healthContext = createHealthContextRepository(transaction);
    const profile = await profiles.create(input.profile);
    const anatomy = await Promise.all(
      input.anatomy.map((entry) => healthContext.setAnatomy({ profileId: profile.id, ...entry })),
    );

    return { profile, anatomy };
  });
}

export async function recordCareEventAndRebuild(
  input: CareEventRecord,
  rebuild: RecommendationRebuilder,
): Promise<CareEvent> {
  return withTransaction(async (transaction) => {
    const event = await createCareEventRepository(transaction).create(input);
    await rebuild(transaction, input.profileId);
    return event;
  });
}

export async function updateRiskFactorsAndRebuild<T extends RiskFactor | RiskFactor[]>(
  profileId: string,
  update: (transaction: TransactionClient) => Promise<T>,
  rebuild: RecommendationRebuilder,
): Promise<T> {
  return withTransaction(async (transaction) => {
    const updated = await update(transaction);
    await rebuild(transaction, profileId);
    return updated;
  });
}

export async function recordSurgeryWithAnatomyAndRebuild(
  surgeryInput: CreateSurgeryRecord,
  anatomyUpdates: Omit<SetAnatomyRecord, "profileId">[],
  rebuild: RecommendationRebuilder,
): Promise<{ surgery: Surgery; anatomy: ProfileAnatomy[] }> {
  return withTransaction(async (transaction) => {
    const healthContext = createHealthContextRepository(transaction);
    const surgery = await healthContext.createSurgery(surgeryInput);
    const anatomy = await Promise.all(
      anatomyUpdates.map((entry) =>
        healthContext.setAnatomy({ profileId: surgeryInput.profileId, ...entry }),
      ),
    );
    await rebuild(transaction, surgeryInput.profileId);
    return { surgery, anatomy };
  });
}

export async function applyClinicianOverrideAndRebuild(
  input: ClinicianOverrideRecord,
  rebuild: RecommendationRebuilder,
): Promise<ClinicianOverride> {
  return withTransaction(async (transaction) => {
    const override = await createClinicianOverrideRepository(transaction).create(input);
    await rebuild(transaction, input.profileId);
    return override;
  });
}

export type AcceptProfileClaimInput = {
  inviteId: string;
  profileId: string;
  ownerUserId: string;
  ownerEmail: string;
  visibility: ProfileVisibility;
  acceptedAt: Date;
};

export async function acceptProfileClaim(input: AcceptProfileClaimInput): Promise<Profile> {
  return withSerializableTransaction(async (transaction) => {
    const invite = await transaction.profileClaimInvite.findFirst({
      where: {
        id: input.inviteId,
        profileId: input.profileId,
        emailNormalized: normalizeEmail(input.ownerEmail),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: input.acceptedAt },
      },
    });

    if (invite === null) {
      throw new NotFoundError();
    }

    const ownershipUpdate = await transaction.profile.updateMany({
      where: { id: input.profileId, ownerUserId: null, deletedAt: null },
      data: {
        ownerUserId: input.ownerUserId,
        claimedAt: input.acceptedAt,
        visibility: input.visibility,
      },
    });

    if (ownershipUpdate.count !== 1) {
      throw new ConflictError("This profile has already been claimed.");
    }

    await transaction.profileClaimInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: input.acceptedAt },
    });
    await transaction.profileAccessGrant.deleteMany({
      where: { profileId: input.profileId },
    });

    const profile = await transaction.profile.findUniqueOrThrow({
      where: { id: input.profileId },
    });
    const existingMembership = await transaction.householdMember.findFirst({
      where: { householdId: profile.householdId, userId: input.ownerUserId },
      orderBy: { joinedAt: "desc" },
    });
    if (existingMembership === null) {
      await transaction.householdMember.create({
        data: {
          householdId: profile.householdId,
          userId: input.ownerUserId,
          role: "member",
          joinedAt: input.acceptedAt,
        },
      });
    } else if (existingMembership.removedAt !== null) {
      await transaction.householdMember.update({
        where: { id: existingMembership.id },
        data: { removedAt: null, role: "member", joinedAt: input.acceptedAt },
      });
    }

    return profile;
  });
}

export type CommitCsvImportResult = {
  alreadyCommitted: boolean;
  eventIds: string[];
};

export async function commitCsvImport(
  batchId: string,
  profileId: string,
  events: CareEventRecord[],
  committedAt: Date,
  rebuild: RecommendationRebuilder,
): Promise<CommitCsvImportResult> {
  return withSerializableTransaction(async (transaction) => {
    const batch = await transaction.importBatch.findUnique({ where: { id: batchId } });
    if (batch === null || batch.profileId !== profileId) {
      throw new NotFoundError();
    }

    if (batch.status === "committed") {
      const existing = await transaction.careEvent.findMany({
        where: { importBatchId: batchId, profileId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      return { alreadyCommitted: true, eventIds: existing.map(({ id }) => id) };
    }

    if (batch.status !== "ready" || events.length !== batch.validCount) {
      throw new ConflictError("This import is not ready to commit.");
    }

    await transaction.importBatch.update({
      where: { id: batchId },
      data: { status: "committing" },
    });

    const repository = createCareEventRepository(transaction);
    const eventIds: string[] = [];
    for (const event of events) {
      if (event.profileId !== profileId) {
        throw new ConflictError("Every import row must belong to the import profile.");
      }

      const created = await repository.create({ ...event, importBatchId: batchId });
      eventIds.push(created.id);
    }

    await rebuild(transaction, profileId);
    await transaction.importBatch.update({
      where: { id: batchId },
      data: { status: "committed", committedAt },
    });

    return { alreadyCommitted: false, eventIds };
  });
}
