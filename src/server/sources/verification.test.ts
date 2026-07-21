import { describe, expect, it, vi } from "vitest";
import { SOURCE_REGISTRY, getSourceBySlug } from "./registry";
import {
  buildSourceInventoryReport,
  sourceFreshnessState,
  verifyLiveSourceUrls,
  verifySourceStructure,
} from "./verification";
import type { GuidelineRuleSourceReference, SourceRegistryEntry } from "./types";

const activeRule = (
  overrides: Partial<GuidelineRuleSourceReference> = {},
): GuidelineRuleSourceReference => ({
  stableKey: "example-rule",
  version: 1,
  sourceSlug: "uspstf-colorectal-cancer-screening-2021",
  reviewStatus: "active",
  effectiveFrom: "2021-05-18",
  effectiveTo: null,
  conflictGroup: null,
  baseline: false,
  importsSourceText: false,
  ...overrides,
});

function requiredSource(slug: string): SourceRegistryEntry {
  const source = getSourceBySlug(slug);
  if (source === null) throw new Error(`Missing test source ${slug}.`);
  return source;
}

describe("source verification", () => {
  it("passes offline structural checks without making a network request", () => {
    const report = verifySourceStructure({
      sources: SOURCE_REGISTRY,
      rules: [activeRule()],
      asOfDate: "2026-07-21",
      generatedAt: "2026-07-21T12:00:00.000Z",
    });
    expect(report.mode).toBe("offline");
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("reports stale sources without disabling them", () => {
    const source = requiredSource("uspstf-colorectal-cancer-screening-2021");
    expect(sourceFreshnessState(source, "2026-07-21")).toBe("current");
    expect(sourceFreshnessState(source, "2027-02-01")).toBe("review_due");
    expect(source.active).toBe(true);

    const report = buildSourceInventoryReport(SOURCE_REGISTRY, "2027-02-01");
    expect(report.byFreshness.review_due).toBeGreaterThan(0);
  });

  it("keeps future and draft metadata distinct", () => {
    expect(
      sourceFreshnessState(
        requiredSource("hrsa-womens-preventive-services-guidelines-2026-future"),
        "2026-07-21",
      ),
    ).toBe("future");
    expect(
      sourceFreshnessState(
        requiredSource("uspstf-cervical-cancer-screening-draft-2024"),
        "2026-07-21",
      ),
    ).toBe("inactive");
  });

  it("rejects missing sources, early activation, and incoherent conflict baselines", () => {
    const report = verifySourceStructure({
      sources: SOURCE_REGISTRY,
      rules: [
        activeRule({ stableKey: "missing", sourceSlug: "missing-source" }),
        activeRule({
          stableKey: "future-too-early",
          sourceSlug: "hrsa-womens-preventive-services-guidelines-2026-future",
          effectiveFrom: "2026-07-21",
        }),
        activeRule({ stableKey: "variant-a", conflictGroup: "screening", baseline: false }),
        activeRule({ stableKey: "variant-b", conflictGroup: "screening", baseline: false }),
      ],
      asOfDate: "2026-07-21",
    });
    expect(report.ok).toBe(false);
    expect(report.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "rule_source_missing",
        "rule_predates_source_effective_date",
        "conflict_group_baseline_invalid",
      ]),
    );
  });

  it("allows one baseline variant to use multiple nonoverlapping rule segments", () => {
    const report = verifySourceStructure({
      sources: SOURCE_REGISTRY,
      rules: [
        activeRule({
          stableKey: "screening-younger",
          variantId: "federal",
          conflictGroup: "screening",
          baseline: true,
        }),
        activeRule({
          stableKey: "screening-older",
          variantId: "federal",
          conflictGroup: "screening",
          baseline: true,
        }),
        activeRule({
          stableKey: "screening-specialty",
          variantId: "specialty",
          conflictGroup: "screening",
          baseline: false,
        }),
      ],
      asOfDate: "2026-07-21",
    });
    expect(report.ok).toBe(true);
  });

  it("requires an attribution contract whenever a rule imports source text", () => {
    const report = verifySourceStructure({
      sources: SOURCE_REGISTRY,
      rules: [activeRule({ importsSourceText: true })],
      asOfDate: "2026-07-21",
    });
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "imported_text_without_attribution_contract" }),
    );
  });

  it("runs network checks only in explicit live mode", async () => {
    const offline = verifySourceStructure({
      sources: [requiredSource("uspstf-colorectal-cancer-screening-2021")],
      asOfDate: "2026-07-21",
    });
    const request = vi.fn(async () => new Response(null, { status: 200 }));
    const live = await verifyLiveSourceUrls(
      offline,
      [requiredSource("uspstf-colorectal-cancer-screening-2021")],
      { fetch: request },
    );
    expect(live.mode).toBe("live");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
