import { Prisma } from "@/generated/prisma/client";
import type {
  AnatomyKey,
  AnatomyState,
  Condition,
  ConditionStatus,
  DatePrecision,
  FamilyHistory,
  HealthContextSource,
  Medication,
  MedicationStatus,
  ProfileAnatomy,
  RiskFactor,
  Surgery,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type SetAnatomyRecord = {
  profileId: string;
  anatomyKey: AnatomyKey;
  state: AnatomyState;
  effectiveDate: Date | null;
  note: string | null;
};

export type CreateRiskFactorRecord = {
  profileId: string;
  type: string;
  valueJson: Prisma.InputJsonValue;
  startedAt: Date | null;
  endedAt: Date | null;
  source: HealthContextSource;
};

export type CreateConditionRecord = {
  profileId: string;
  code: string;
  displayName: string;
  status: ConditionStatus;
  diagnosedStart: Date | null;
  diagnosedEnd: Date | null;
  diagnosedDatePrecision: DatePrecision;
  note: string | null;
};

export type CreateFamilyHistoryRecord = {
  profileId: string;
  relationship: string;
  conditionCode: string;
  conditionDisplay: string;
  ageAtDiagnosis: number | null;
  note: string | null;
};

export type CreateSurgeryRecord = {
  profileId: string;
  code: string;
  displayName: string;
  performedStart: Date | null;
  performedEnd: Date | null;
  performedDatePrecision: DatePrecision;
  anatomyEffectsJson: Prisma.InputJsonValue | null;
  note: string | null;
};

export type CreateMedicationRecord = {
  profileId: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  prescriber: string | null;
  reason: string | null;
  startedStart: Date | null;
  startedEnd: Date | null;
  startedDatePrecision: DatePrecision;
  endedStart: Date | null;
  endedEnd: Date | null;
  endedDatePrecision: DatePrecision | null;
  status: MedicationStatus;
  monitoringInstructions: string | null;
  nextReviewDate: Date | null;
};

export type HealthContextSnapshot = {
  anatomy: ProfileAnatomy[];
  riskFactors: RiskFactor[];
  conditions: Condition[];
  familyHistory: FamilyHistory[];
  surgeries: Surgery[];
  medications: Medication[];
};

export interface HealthContextRepository {
  loadProfileContext(profileId: string): Promise<HealthContextSnapshot>;
  setAnatomy(input: SetAnatomyRecord): Promise<ProfileAnatomy>;
  createRiskFactor(input: CreateRiskFactorRecord): Promise<RiskFactor>;
  softDeleteRiskFactor(id: string, deletedAt: Date): Promise<RiskFactor>;
  createCondition(input: CreateConditionRecord): Promise<Condition>;
  softDeleteCondition(id: string, deletedAt: Date): Promise<Condition>;
  createFamilyHistory(input: CreateFamilyHistoryRecord): Promise<FamilyHistory>;
  softDeleteFamilyHistory(id: string, deletedAt: Date): Promise<FamilyHistory>;
  createSurgery(input: CreateSurgeryRecord): Promise<Surgery>;
  softDeleteSurgery(id: string, deletedAt: Date): Promise<Surgery>;
  createMedication(input: CreateMedicationRecord): Promise<Medication>;
  softDeleteMedication(id: string, deletedAt: Date): Promise<Medication>;
}

export function createHealthContextRepository(
  database: DatabaseClient = prisma,
): HealthContextRepository {
  return {
    async loadProfileContext(profileId) {
      const [anatomy, riskFactors, conditions, familyHistory, surgeries, medications] =
        await Promise.all([
          database.profileAnatomy.findMany({
            where: { profileId },
            orderBy: { anatomyKey: "asc" },
          }),
          database.riskFactor.findMany({
            where: { profileId, deletedAt: null },
            orderBy: [{ type: "asc" }, { createdAt: "asc" }],
          }),
          database.condition.findMany({
            where: { profileId, deletedAt: null },
            orderBy: [{ code: "asc" }, { createdAt: "asc" }],
          }),
          database.familyHistory.findMany({
            where: { profileId, deletedAt: null },
            orderBy: [{ conditionCode: "asc" }, { createdAt: "asc" }],
          }),
          database.surgery.findMany({
            where: { profileId, deletedAt: null },
            orderBy: [{ performedStart: "asc" }, { createdAt: "asc" }],
          }),
          database.medication.findMany({
            where: { profileId, deletedAt: null },
            orderBy: [{ status: "asc" }, { name: "asc" }],
          }),
        ]);

      return { anatomy, riskFactors, conditions, familyHistory, surgeries, medications };
    },

    setAnatomy(input) {
      return database.profileAnatomy.upsert({
        where: {
          profileId_anatomyKey: {
            profileId: input.profileId,
            anatomyKey: input.anatomyKey,
          },
        },
        create: {
          profileId: input.profileId,
          anatomyKey: input.anatomyKey,
          state: input.state,
          effectiveDate: input.effectiveDate,
          note: normalizeNullableText(input.note),
        },
        update: {
          state: input.state,
          effectiveDate: input.effectiveDate,
          note: normalizeNullableText(input.note),
        },
      });
    },

    createRiskFactor(input) {
      return database.riskFactor.create({
        data: {
          profileId: input.profileId,
          type: normalizeText(input.type),
          valueJson: input.valueJson,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          source: input.source,
        },
      });
    },

    softDeleteRiskFactor(id, deletedAt) {
      return database.riskFactor.update({ where: { id }, data: { deletedAt } });
    },

    createCondition(input) {
      return database.condition.create({
        data: {
          ...input,
          code: normalizeText(input.code),
          displayName: normalizeText(input.displayName),
          note: normalizeNullableText(input.note),
        },
      });
    },

    softDeleteCondition(id, deletedAt) {
      return database.condition.update({ where: { id }, data: { deletedAt } });
    },

    createFamilyHistory(input) {
      return database.familyHistory.create({
        data: {
          ...input,
          relationship: normalizeText(input.relationship),
          conditionCode: normalizeText(input.conditionCode),
          conditionDisplay: normalizeText(input.conditionDisplay),
          note: normalizeNullableText(input.note),
        },
      });
    },

    softDeleteFamilyHistory(id, deletedAt) {
      return database.familyHistory.update({ where: { id }, data: { deletedAt } });
    },

    createSurgery(input) {
      return database.surgery.create({
        data: {
          profileId: input.profileId,
          code: normalizeText(input.code),
          displayName: normalizeText(input.displayName),
          performedStart: input.performedStart,
          performedEnd: input.performedEnd,
          performedDatePrecision: input.performedDatePrecision,
          anatomyEffectsJson:
            input.anatomyEffectsJson === null ? Prisma.DbNull : input.anatomyEffectsJson,
          note: normalizeNullableText(input.note),
        },
      });
    },

    softDeleteSurgery(id, deletedAt) {
      return database.surgery.update({ where: { id }, data: { deletedAt } });
    },

    createMedication(input) {
      return database.medication.create({
        data: {
          ...input,
          name: normalizeText(input.name),
          dose: normalizeNullableText(input.dose),
          frequency: normalizeNullableText(input.frequency),
          prescriber: normalizeNullableText(input.prescriber),
          reason: normalizeNullableText(input.reason),
          monitoringInstructions: normalizeNullableText(input.monitoringInstructions),
        },
      });
    },

    softDeleteMedication(id, deletedAt) {
      return database.medication.update({ where: { id }, data: { deletedAt } });
    },
  };
}

export const healthContextRepository = createHealthContextRepository();
