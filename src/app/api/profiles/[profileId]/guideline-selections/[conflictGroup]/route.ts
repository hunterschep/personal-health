import { NextResponse } from "next/server";
import { z } from "zod";

import { dateInTimeZone } from "@/domain/dates";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { rebuildRecommendations, recommendationChangeCounts } from "@/server/recommendations";

const selectionSchema = z.object({
  variantId: z.string().trim().min(1).max(100),
});

type RouteContext = {
  params: Promise<{ profileId: string; conflictGroup: string }>;
};

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

type RecommendationSummary = {
  id: string;
  variantId: string;
  status: string;
  dueStart: Date | null;
  dueEnd: Date | null;
};

const recommendationSummarySelect = {
  id: true,
  variantId: true,
  status: true,
  dueStart: true,
  dueEnd: true,
} as const;

function responseRecommendation(recommendation: RecommendationSummary | null) {
  return recommendation === null
    ? null
    : {
        ...recommendation,
        dueStart: recommendation.dueStart?.toISOString().slice(0, 10) ?? null,
        dueEnd: recommendation.dueEnd?.toISOString().slice(0, 10) ?? null,
      };
}

function recommendationChanges(
  rebuilt: Awaited<ReturnType<typeof rebuildRecommendations>>,
  before: RecommendationSummary | null,
  after: RecommendationSummary | null,
) {
  return {
    before: responseRecommendation(before),
    after: responseRecommendation(after),
    byType: recommendationChangeCounts(rebuilt.changes),
    created: rebuilt.createdIds.length,
    retired: rebuilt.retiredIds.length,
    unchanged: rebuilt.unchangedIds.length,
  };
}

async function availableRules(profileId: string, conflictGroup: string) {
  const { profile } = await requireProfileAccess(profileId, "view");
  const asOfDate = dateInTimeZone(new Date(), profile.timezone);
  const rules = await prisma.guidelineRule.findMany({
    where: {
      conflictGroup,
      jurisdiction: profile.countryCode,
      reviewStatus: "active",
      effectiveFrom: { lte: asDate(asOfDate) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asDate(asOfDate) } }],
      service: { active: true },
      source: { active: true },
    },
    include: { service: true, source: true },
    orderBy: [{ isBaseline: "desc" }, { variantId: "asc" }, { stableKey: "asc" }],
  });
  if (rules.length === 0) {
    throw new NotFoundError("This guideline comparison is not available.");
  }
  return { profile, rules, asOfDate };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { profileId, conflictGroup } = await params;
    const { profile, rules, asOfDate } = await availableRules(profileId, conflictGroup);
    const selection = await prisma.profileGuidelineSelection.findUnique({
      where: { profileId_conflictGroup: { profileId: profile.id, conflictGroup } },
    });
    const variants = new Map<
      string,
      {
        variantId: string;
        baseline: boolean;
        sources: Set<string>;
        summaries: Set<string>;
      }
    >();
    for (const rule of rules) {
      const variant = variants.get(rule.variantId) ?? {
        variantId: rule.variantId,
        baseline: false,
        sources: new Set<string>(),
        summaries: new Set<string>(),
      };
      variant.baseline ||= rule.isBaseline;
      variant.sources.add(rule.source.organization);
      variant.summaries.add(rule.consumerSummary);
      variants.set(rule.variantId, variant);
    }
    return NextResponse.json(
      {
        asOfDate,
        conflictGroup,
        selectedVariantId:
          selection?.variantId ??
          [...variants.values()].find((variant) => variant.baseline)?.variantId ??
          null,
        explicitSelection: selection !== null,
        variants: [...variants.values()].map((variant) => ({
          variantId: variant.variantId,
          baseline: variant.baseline,
          sources: [...variant.sources],
          summaries: [...variant.summaries],
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, conflictGroup } = await params;
    const input = selectionSchema.parse(await request.json());
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const asOfDate = dateInTimeZone(new Date(), profile.timezone);
    const rules = await prisma.guidelineRule.findMany({
      where: {
        conflictGroup,
        variantId: input.variantId,
        jurisdiction: profile.countryCode,
        reviewStatus: "active",
        effectiveFrom: { lte: asDate(asOfDate) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asDate(asOfDate) } }],
        service: { active: true },
        source: { active: true },
      },
      select: { id: true, serviceId: true },
    });
    const selectedRule = rules[0];
    if (selectedRule === undefined) {
      throw new ValidationError("Choose an active variant from this guideline comparison.");
    }
    const selectedServiceId = selectedRule.serviceId;
    const previousRecommendation = await prisma.recommendationInstance.findFirst({
      where: {
        profileId: profile.id,
        serviceId: selectedServiceId,
        conflictGroup,
        retiredAt: null,
      },
      select: recommendationSummarySelect,
      orderBy: { createdAt: "desc" },
    });

    const result = await prisma.$transaction(async (database) => {
      const selection = await database.profileGuidelineSelection.upsert({
        where: { profileId_conflictGroup: { profileId: profile.id, conflictGroup } },
        create: {
          profileId: profile.id,
          conflictGroup,
          variantId: input.variantId,
          selectedByUserId: session.user.id,
        },
        update: {
          variantId: input.variantId,
          selectedByUserId: session.user.id,
          selectedAt: new Date(),
        },
      });
      const rebuilt = await rebuildRecommendations(database, profile.id, asOfDate, {
        actorUserId: session.user.id,
        reason: "guideline_variant_selected",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "guideline_variant.selected",
          entityType: "ProfileGuidelineSelection",
          entityId: selection.id,
          metadataJson: {},
        },
      });
      const activeRecommendation = await database.recommendationInstance.findFirst({
        where: {
          profileId: profile.id,
          serviceId: selectedServiceId,
          variantId: input.variantId,
          retiredAt: null,
        },
        select: recommendationSummarySelect,
        orderBy: { createdAt: "desc" },
      });
      return { selection, rebuilt, activeRecommendation };
    });

    return NextResponse.json({
      ok: true,
      selectedVariantId: result.selection.variantId,
      activeRecommendationId: result.activeRecommendation?.id,
      recommendationChanges: recommendationChanges(
        result.rebuilt,
        previousRecommendation,
        result.activeRecommendation,
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, conflictGroup } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const asOfDate = dateInTimeZone(new Date(), profile.timezone);
    const existing = await prisma.profileGuidelineSelection.findUnique({
      where: { profileId_conflictGroup: { profileId: profile.id, conflictGroup } },
    });
    const previousRecommendation = await prisma.recommendationInstance.findFirst({
      where: { profileId: profile.id, conflictGroup, retiredAt: null },
      select: recommendationSummarySelect,
      orderBy: { createdAt: "desc" },
    });
    if (existing === null) {
      return NextResponse.json({
        ok: true,
        selectedVariantId: previousRecommendation?.variantId,
        activeRecommendationId: previousRecommendation?.id,
        recommendationChanges: {
          before: responseRecommendation(previousRecommendation),
          after: responseRecommendation(previousRecommendation),
          byType: recommendationChangeCounts([]),
          created: 0,
          retired: 0,
          unchanged: 0,
        },
      });
    }

    const result = await prisma.$transaction(async (database) => {
      await database.profileGuidelineSelection.delete({ where: { id: existing.id } });
      const rebuilt = await rebuildRecommendations(database, profile.id, asOfDate, {
        actorUserId: session.user.id,
        reason: "guideline_variant_selected",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "guideline_variant.reset_to_baseline",
          entityType: "ProfileGuidelineSelection",
          entityId: existing.id,
          metadataJson: {},
        },
      });
      const activeRecommendation = await database.recommendationInstance.findFirst({
        where: { profileId: profile.id, conflictGroup, retiredAt: null },
        select: recommendationSummarySelect,
        orderBy: { createdAt: "desc" },
      });
      return { activeRecommendation, rebuilt };
    });
    return NextResponse.json({
      ok: true,
      selectedVariantId: result.activeRecommendation?.variantId,
      activeRecommendationId: result.activeRecommendation?.id,
      recommendationChanges: recommendationChanges(
        result.rebuilt,
        previousRecommendation,
        result.activeRecommendation,
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}
