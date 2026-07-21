import type {
  CarePlanMode,
  Profile,
  ProfileVisibility,
  SexAssignedAtBirth,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeCountryCode, normalizeNullableText, normalizeText } from "./normalize";

export type CreateProfileRecord = {
  id?: string;
  householdId: string;
  ownerUserId: string | null;
  createdByUserId: string;
  displayName: string;
  relationshipLabel: string;
  dateOfBirth: Date;
  sexAssignedAtBirth: SexAssignedAtBirth;
  genderIdentity: string | null;
  countryCode: string;
  timezone: string;
  carePlanMode: CarePlanMode;
  visibility: ProfileVisibility;
  claimedAt: Date | null;
};

export type UpdateProfileRecord = Pick<
  CreateProfileRecord,
  | "displayName"
  | "relationshipLabel"
  | "dateOfBirth"
  | "sexAssignedAtBirth"
  | "genderIdentity"
  | "countryCode"
  | "timezone"
  | "carePlanMode"
  | "visibility"
>;

export interface ProfileRepository {
  create(input: CreateProfileRecord): Promise<Profile>;
  findActiveById(id: string): Promise<Profile | null>;
  listActiveForHousehold(householdId: string): Promise<Profile[]>;
  update(id: string, input: UpdateProfileRecord): Promise<Profile>;
  softDelete(id: string, deletedAt: Date): Promise<Profile>;
}

export function createProfileRepository(database: DatabaseClient = prisma): ProfileRepository {
  return {
    create(input) {
      const data = {
        householdId: input.householdId,
        ownerUserId: input.ownerUserId,
        createdByUserId: input.createdByUserId,
        displayName: normalizeText(input.displayName),
        relationshipLabel: normalizeText(input.relationshipLabel),
        dateOfBirth: input.dateOfBirth,
        sexAssignedAtBirth: input.sexAssignedAtBirth,
        genderIdentity: normalizeNullableText(input.genderIdentity),
        countryCode: normalizeCountryCode(input.countryCode),
        timezone: normalizeText(input.timezone),
        carePlanMode: input.carePlanMode,
        visibility: input.visibility,
        claimedAt: input.claimedAt,
      };

      return input.id === undefined
        ? database.profile.create({ data })
        : database.profile.create({ data: { ...data, id: input.id } });
    },

    findActiveById(id) {
      return database.profile.findFirst({ where: { id, deletedAt: null } });
    },

    listActiveForHousehold(householdId) {
      return database.profile.findMany({
        where: { householdId, deletedAt: null },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
      });
    },

    update(id, input) {
      return database.profile.update({
        where: { id },
        data: {
          displayName: normalizeText(input.displayName),
          relationshipLabel: normalizeText(input.relationshipLabel),
          dateOfBirth: input.dateOfBirth,
          sexAssignedAtBirth: input.sexAssignedAtBirth,
          genderIdentity: normalizeNullableText(input.genderIdentity),
          countryCode: normalizeCountryCode(input.countryCode),
          timezone: normalizeText(input.timezone),
          carePlanMode: input.carePlanMode,
          visibility: input.visibility,
        },
      });
    },

    softDelete(id, deletedAt) {
      return database.profile.update({ where: { id }, data: { deletedAt } });
    },
  };
}

export const profileRepository = createProfileRepository();
