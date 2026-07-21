import {
  Prisma,
  type ClinicianOverride,
  type ClinicianOverrideType,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText } from "./normalize";

export type ClinicianOverrideRecord = {
  profileId: string;
  serviceId: string;
  methodId: string | null;
  overrideType: ClinicianOverrideType;
  nextDueStart: Date | null;
  nextDueEnd: Date | null;
  intervalJson: Prisma.InputJsonValue | null;
  replacesGeneralGuideline: boolean;
  clinicianName: string | null;
  practiceName: string | null;
  instructionReceivedDate: Date;
  reason: string | null;
  reviewDate: Date | null;
  active: boolean;
  createdByUserId: string;
};

export interface ClinicianOverrideRepository {
  create(input: ClinicianOverrideRecord): Promise<ClinicianOverride>;
  findActiveById(id: string): Promise<ClinicianOverride | null>;
  listActiveForProfile(profileId: string): Promise<ClinicianOverride[]>;
  deactivate(id: string): Promise<ClinicianOverride>;
}

export function createClinicianOverrideRepository(
  database: DatabaseClient = prisma,
): ClinicianOverrideRepository {
  return {
    create(input) {
      return database.clinicianOverride.create({
        data: {
          profileId: input.profileId,
          serviceId: input.serviceId,
          methodId: input.methodId,
          overrideType: input.overrideType,
          nextDueStart: input.nextDueStart,
          nextDueEnd: input.nextDueEnd,
          intervalJson: input.intervalJson === null ? Prisma.DbNull : input.intervalJson,
          replacesGeneralGuideline: input.replacesGeneralGuideline,
          clinicianName: normalizeNullableText(input.clinicianName),
          practiceName: normalizeNullableText(input.practiceName),
          instructionReceivedDate: input.instructionReceivedDate,
          reason: normalizeNullableText(input.reason),
          reviewDate: input.reviewDate,
          active: input.active,
          createdByUserId: input.createdByUserId,
        },
      });
    },

    findActiveById(id) {
      return database.clinicianOverride.findFirst({
        where: { id, active: true, pausedAt: null },
      });
    },

    listActiveForProfile(profileId) {
      return database.clinicianOverride.findMany({
        where: { profileId, active: true, pausedAt: null },
        orderBy: [{ reviewDate: "asc" }, { createdAt: "desc" }],
      });
    },

    deactivate(id) {
      return database.clinicianOverride.update({ where: { id }, data: { active: false } });
    },
  };
}

export const clinicianOverrideRepository = createClinicianOverrideRepository();
