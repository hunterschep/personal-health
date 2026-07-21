import type {
  GuidelineRule,
  GuidelineSource,
  Prisma,
  ProfileGuidelineSelection,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type UpsertGuidelineSourceRecord = {
  slug: string;
  organization: string;
  title: string;
  canonicalUrl: string;
  sourceType: string;
  jurisdiction: string;
  publishedAt: Date | null;
  effectiveAt: Date | null;
  lastVerifiedAt: Date;
  contentHash: string | null;
  attributionText: string | null;
  licenseOrTermsUrl: string | null;
  active: boolean;
};

export interface GuidelineRepository {
  findSourceBySlug(slug: string): Promise<GuidelineSource | null>;
  listActiveSources(): Promise<GuidelineSource[]>;
  upsertSource(input: UpsertGuidelineSourceRecord): Promise<GuidelineSource>;
  createRuleVersion(input: Prisma.GuidelineRuleUncheckedCreateInput): Promise<GuidelineRule>;
  findRuleVersion(stableKey: string, version: number): Promise<GuidelineRule | null>;
  listActiveRules(asOfDate: Date, jurisdiction: string): Promise<GuidelineRule[]>;
  listActiveRulesForService(serviceId: string, asOfDate: Date): Promise<GuidelineRule[]>;
  listSelections(profileId: string): Promise<ProfileGuidelineSelection[]>;
  selectVariant(
    profileId: string,
    conflictGroup: string,
    variantId: string,
    selectedByUserId: string,
    selectedAt: Date,
  ): Promise<ProfileGuidelineSelection>;
  clearSelection(profileId: string, conflictGroup: string): Promise<ProfileGuidelineSelection>;
}

export function createGuidelineRepository(database: DatabaseClient = prisma): GuidelineRepository {
  return {
    findSourceBySlug(slug) {
      return database.guidelineSource.findUnique({ where: { slug: normalizeText(slug) } });
    },

    listActiveSources() {
      return database.guidelineSource.findMany({
        where: { active: true },
        orderBy: [{ organization: "asc" }, { title: "asc" }],
      });
    },

    upsertSource(input) {
      const slug = normalizeText(input.slug);
      const data = {
        organization: normalizeText(input.organization),
        title: normalizeText(input.title),
        canonicalUrl: normalizeText(input.canonicalUrl),
        sourceType: normalizeText(input.sourceType),
        jurisdiction: normalizeText(input.jurisdiction),
        publishedAt: input.publishedAt,
        effectiveAt: input.effectiveAt,
        lastVerifiedAt: input.lastVerifiedAt,
        contentHash: normalizeNullableText(input.contentHash),
        attributionText: normalizeNullableText(input.attributionText),
        licenseOrTermsUrl: normalizeNullableText(input.licenseOrTermsUrl),
        active: input.active,
      };

      return database.guidelineSource.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    },

    createRuleVersion(input) {
      return database.guidelineRule.create({ data: input });
    },

    findRuleVersion(stableKey, version) {
      return database.guidelineRule.findUnique({
        where: { stableKey_version: { stableKey: normalizeText(stableKey), version } },
      });
    },

    listActiveRules(asOfDate, jurisdiction) {
      return database.guidelineRule.findMany({
        where: {
          jurisdiction,
          reviewStatus: "active",
          effectiveFrom: { lte: asOfDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
        },
        orderBy: [{ stableKey: "asc" }, { version: "desc" }],
      });
    },

    listActiveRulesForService(serviceId, asOfDate) {
      return database.guidelineRule.findMany({
        where: {
          serviceId,
          reviewStatus: "active",
          effectiveFrom: { lte: asOfDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
        },
        orderBy: [{ isBaseline: "desc" }, { stableKey: "asc" }, { version: "desc" }],
      });
    },

    listSelections(profileId) {
      return database.profileGuidelineSelection.findMany({
        where: { profileId },
        orderBy: { conflictGroup: "asc" },
      });
    },

    selectVariant(profileId, conflictGroup, variantId, selectedByUserId, selectedAt) {
      return database.profileGuidelineSelection.upsert({
        where: { profileId_conflictGroup: { profileId, conflictGroup } },
        create: { profileId, conflictGroup, variantId, selectedByUserId, selectedAt },
        update: { variantId, selectedByUserId, selectedAt },
      });
    },

    clearSelection(profileId, conflictGroup) {
      return database.profileGuidelineSelection.delete({
        where: { profileId_conflictGroup: { profileId, conflictGroup } },
      });
    },
  };
}

export const guidelineRepository = createGuidelineRepository();
