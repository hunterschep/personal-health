import type { PlannedAction, PlannedActionStatus } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type PlannedActionRecord = {
  profileId: string;
  recommendationInstanceId: string | null;
  serviceId: string;
  title: string;
  plannedMonth: Date | null;
  appointmentStart: Date | null;
  appointmentEnd: Date | null;
  timezone: string;
  location: string | null;
  notes: string | null;
  status: PlannedActionStatus;
  createdByUserId: string;
};

export interface PlannedActionRepository {
  create(input: PlannedActionRecord): Promise<PlannedAction>;
  findById(id: string): Promise<PlannedAction | null>;
  listForProfile(profileId: string): Promise<PlannedAction[]>;
  update(id: string, input: PlannedActionRecord): Promise<PlannedAction>;
  setStatus(id: string, status: PlannedActionStatus): Promise<PlannedAction>;
}

function normalizedActionData(input: PlannedActionRecord) {
  return {
    profileId: input.profileId,
    recommendationInstanceId: input.recommendationInstanceId,
    serviceId: input.serviceId,
    title: normalizeText(input.title),
    plannedMonth: input.plannedMonth,
    appointmentStart: input.appointmentStart,
    appointmentEnd: input.appointmentEnd,
    timezone: normalizeText(input.timezone),
    location: normalizeNullableText(input.location),
    notes: normalizeNullableText(input.notes),
    status: input.status,
    createdByUserId: input.createdByUserId,
  };
}

export function createPlannedActionRepository(
  database: DatabaseClient = prisma,
): PlannedActionRepository {
  return {
    create(input) {
      return database.plannedAction.create({ data: normalizedActionData(input) });
    },

    findById(id) {
      return database.plannedAction.findUnique({ where: { id } });
    },

    listForProfile(profileId) {
      return database.plannedAction.findMany({
        where: { profileId },
        orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }, { createdAt: "asc" }],
      });
    },

    update(id, input) {
      return database.plannedAction.update({
        where: { id },
        data: normalizedActionData(input),
      });
    },

    setStatus(id, status) {
      return database.plannedAction.update({ where: { id }, data: { status } });
    },
  };
}

export const plannedActionRepository = createPlannedActionRepository();
