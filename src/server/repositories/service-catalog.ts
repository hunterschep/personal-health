import {
  Prisma,
  type ServiceCatalog,
  type ServiceCategory,
  type ServiceMethod,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type UpsertServiceRecord = {
  slug: string;
  name: string;
  shortName: string;
  category: ServiceCategory;
  description: string;
  bodySystem: string | null;
  eventType: string;
  active: boolean;
  sortOrder: number;
};

export type UpsertServiceMethodRecord = {
  serviceId: string;
  slug: string;
  name: string;
  description: string;
  active: boolean;
  metadataJson: Prisma.InputJsonValue | null;
};

export interface ServiceCatalogRepository {
  findActiveById(id: string): Promise<ServiceCatalog | null>;
  findActiveBySlug(slug: string): Promise<ServiceCatalog | null>;
  listActive(): Promise<ServiceCatalog[]>;
  listActiveMethods(serviceId: string): Promise<ServiceMethod[]>;
  findMethod(serviceId: string, slug: string): Promise<ServiceMethod | null>;
  upsertService(input: UpsertServiceRecord): Promise<ServiceCatalog>;
  upsertMethod(input: UpsertServiceMethodRecord): Promise<ServiceMethod>;
}

export function createServiceCatalogRepository(
  database: DatabaseClient = prisma,
): ServiceCatalogRepository {
  return {
    findActiveById(id) {
      return database.serviceCatalog.findFirst({ where: { id, active: true } });
    },

    findActiveBySlug(slug) {
      return database.serviceCatalog.findFirst({
        where: { slug: normalizeText(slug), active: true },
      });
    },

    listActive() {
      return database.serviceCatalog.findMany({
        where: { active: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      });
    },

    listActiveMethods(serviceId) {
      return database.serviceMethod.findMany({
        where: { serviceId, active: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
    },

    findMethod(serviceId, slug) {
      return database.serviceMethod.findFirst({
        where: { serviceId, slug: normalizeText(slug), active: true },
      });
    },

    upsertService(input) {
      const slug = normalizeText(input.slug);
      const data = {
        name: normalizeText(input.name),
        shortName: normalizeText(input.shortName),
        category: input.category,
        description: normalizeText(input.description),
        bodySystem: normalizeNullableText(input.bodySystem),
        eventType: normalizeText(input.eventType),
        active: input.active,
        sortOrder: input.sortOrder,
      };

      return database.serviceCatalog.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    },

    upsertMethod(input) {
      const slug = normalizeText(input.slug);
      const data = {
        name: normalizeText(input.name),
        description: normalizeText(input.description),
        active: input.active,
        metadataJson: input.metadataJson === null ? Prisma.DbNull : input.metadataJson,
      };

      return database.serviceMethod.upsert({
        where: { serviceId_slug: { serviceId: input.serviceId, slug } },
        create: { serviceId: input.serviceId, slug, ...data },
        update: data,
      });
    },
  };
}

export const serviceCatalogRepository = createServiceCatalogRepository();
