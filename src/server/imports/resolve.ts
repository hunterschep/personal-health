import type { CareEvent, ServiceCatalog, ServiceMethod } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";

import type { NormalizedImportRow } from "./types";

type CatalogService = Pick<ServiceCatalog, "id" | "slug" | "name"> & {
  methods: Pick<ServiceMethod, "id" | "slug" | "name">[];
};

type ExistingEvent = Pick<
  CareEvent,
  "id" | "serviceId" | "methodId" | "performedStart" | "performedEnd" | "providerName"
>;

function lookupKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizedProvider(value: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") ?? "";
  return normalized === "" ? null : normalized;
}

function rangesOverlap(
  leftStart: string | null,
  leftEnd: string | null,
  rightStart: Date | null,
  rightEnd: Date | null,
): boolean {
  if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) {
    return leftStart === null && leftEnd === null && rightStart === null && rightEnd === null;
  }
  const rightStartIso = rightStart.toISOString().slice(0, 10);
  const rightEndIso = rightEnd.toISOString().slice(0, 10);
  return leftStart <= rightEndIso && rightStartIso <= leftEnd;
}

export function resolveImportRows(
  rows: readonly NormalizedImportRow[],
  services: readonly CatalogService[],
  existingEvents: readonly ExistingEvent[],
): NormalizedImportRow[] {
  const resolved: NormalizedImportRow[] = [];

  for (const original of rows) {
    const row: NormalizedImportRow = {
      ...original,
      errors: [...original.errors],
      warnings: [...original.warnings],
      possibleDuplicateIds: [...original.possibleDuplicateIds],
    };
    const serviceKey = lookupKey(row.service);
    const matches = services.filter(
      (service) => lookupKey(service.slug) === serviceKey || lookupKey(service.name) === serviceKey,
    );
    if (matches.length !== 1) {
      row.errors.push("Service was not recognized. Use a catalog slug or exact display name.");
      resolved.push(row);
      continue;
    }

    const service = matches[0];
    if (service === undefined) continue;
    row.serviceId = service.id;
    if (row.method !== null) {
      const methodKey = lookupKey(row.method);
      const methodMatches = service.methods.filter(
        (method) => lookupKey(method.slug) === methodKey || lookupKey(method.name) === methodKey,
      );
      if (methodMatches.length !== 1) {
        row.errors.push("Method was not recognized for this service.");
      } else {
        row.methodId = methodMatches[0]?.id ?? null;
      }
    }

    if (row.errors.length === 0) {
      const duplicates = existingEvents.filter(
        (event) =>
          event.serviceId === row.serviceId &&
          event.methodId === row.methodId &&
          (normalizedProvider(row.provider) === null ||
            normalizedProvider(event.providerName) === normalizedProvider(row.provider)) &&
          rangesOverlap(
            row.performedStart,
            row.performedEnd,
            event.performedStart,
            event.performedEnd,
          ),
      );
      if (duplicates.length > 0) {
        row.possibleDuplicateIds.push(...duplicates.map((event) => event.id));
        row.warnings.push("A similar care event already exists for this profile.");
      }
      const duplicatePreview = resolved.find(
        (candidate) =>
          candidate.errors.length === 0 &&
          candidate.serviceId === row.serviceId &&
          candidate.methodId === row.methodId &&
          (normalizedProvider(row.provider) === null ||
            normalizedProvider(candidate.provider) === normalizedProvider(row.provider)) &&
          (row.performedStart === null ||
          row.performedEnd === null ||
          candidate.performedStart === null ||
          candidate.performedEnd === null
            ? row.performedStart === null && candidate.performedStart === null
            : row.performedStart <= candidate.performedEnd &&
              candidate.performedStart <= row.performedEnd),
      );
      if (duplicatePreview !== undefined) {
        row.warnings.push(`This appears to duplicate CSV row ${duplicatePreview.rowNumber}.`);
      }
    }
    resolved.push(row);
  }
  return resolved;
}

export async function resolveImportRowsForProfile(
  profileId: string,
  rows: readonly NormalizedImportRow[],
): Promise<NormalizedImportRow[]> {
  const [services, existingEvents] = await Promise.all([
    prisma.serviceCatalog.findMany({
      where: { active: true },
      select: {
        id: true,
        slug: true,
        name: true,
        methods: {
          where: { active: true },
          select: { id: true, slug: true, name: true },
        },
      },
    }),
    prisma.careEvent.findMany({
      where: { profileId, deletedAt: null },
      select: {
        id: true,
        serviceId: true,
        methodId: true,
        performedStart: true,
        performedEnd: true,
        providerName: true,
      },
    }),
  ]);
  return resolveImportRows(rows, services, existingEvents);
}
