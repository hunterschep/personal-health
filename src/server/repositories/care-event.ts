import { createHash } from "node:crypto";

import type {
  CareEvent,
  CareEventResult,
  CareEventSource,
  DatePrecision,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText } from "./normalize";

export type CareEventRecord = {
  profileId: string;
  serviceId: string;
  methodId: string | null;
  performedStart: Date | null;
  performedEnd: Date | null;
  datePrecision: DatePrecision;
  result: CareEventResult;
  providerName: string | null;
  locationName: string | null;
  notes: string | null;
  source: CareEventSource;
  importBatchId: string | null;
  createdByUserId: string;
};

function dateKey(value: Date | null): string {
  return value === null ? "unknown" : value.toISOString().slice(0, 10);
}

export function careEventFingerprint(input: CareEventRecord): string {
  const normalizedProvider = normalizeNullableText(input.providerName)?.toLocaleLowerCase("en-US");
  const components = [
    input.profileId,
    input.serviceId,
    input.methodId ?? "no-method",
    dateKey(input.performedStart),
    dateKey(input.performedEnd),
    normalizedProvider ?? "no-provider",
  ];

  return createHash("sha256").update(components.join("\u001f"), "utf8").digest("hex");
}

export interface CareEventRepository {
  create(input: CareEventRecord): Promise<CareEvent>;
  findActiveById(id: string): Promise<CareEvent | null>;
  listActiveForProfile(profileId: string, serviceId?: string): Promise<CareEvent[]>;
  findPossibleDuplicates(input: CareEventRecord): Promise<CareEvent[]>;
  update(id: string, input: CareEventRecord): Promise<CareEvent>;
  softDelete(id: string, deletedAt: Date): Promise<CareEvent>;
}

function normalizedEventData(input: CareEventRecord) {
  return {
    profileId: input.profileId,
    serviceId: input.serviceId,
    methodId: input.methodId,
    performedStart: input.performedStart,
    performedEnd: input.performedEnd,
    datePrecision: input.datePrecision,
    result: input.result,
    providerName: normalizeNullableText(input.providerName),
    locationName: normalizeNullableText(input.locationName),
    notes: normalizeNullableText(input.notes),
    source: input.source,
    importBatchId: input.importBatchId,
    duplicateFingerprint: careEventFingerprint(input),
    createdByUserId: input.createdByUserId,
  };
}

export function createCareEventRepository(database: DatabaseClient = prisma): CareEventRepository {
  return {
    create(input) {
      return database.careEvent.create({ data: normalizedEventData(input) });
    },

    findActiveById(id) {
      return database.careEvent.findFirst({ where: { id, deletedAt: null } });
    },

    listActiveForProfile(profileId, serviceId) {
      return database.careEvent.findMany({
        where:
          serviceId === undefined
            ? { profileId, deletedAt: null }
            : { profileId, serviceId, deletedAt: null },
        orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      });
    },

    findPossibleDuplicates(input) {
      const fingerprint = careEventFingerprint(input);
      return database.careEvent.findMany({
        where: {
          profileId: input.profileId,
          serviceId: input.serviceId,
          methodId: input.methodId,
          deletedAt: null,
          OR: [
            { duplicateFingerprint: fingerprint },
            input.performedStart === null || input.performedEnd === null
              ? { datePrecision: "unknown" }
              : {
                  performedStart: { lte: input.performedEnd },
                  performedEnd: { gte: input.performedStart },
                },
          ],
        },
        orderBy: [{ performedStart: "desc" }, { createdAt: "desc" }],
      });
    },

    update(id, input) {
      return database.careEvent.update({
        where: { id },
        data: normalizedEventData(input),
      });
    },

    softDelete(id, deletedAt) {
      return database.careEvent.update({ where: { id }, data: { deletedAt } });
    },
  };
}

export const careEventRepository = createCareEventRepository();
