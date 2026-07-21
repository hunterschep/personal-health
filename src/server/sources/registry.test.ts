import { describe, expect, it } from "vitest";
import { getPublicSourceMetadata, getSourceBySlug, SOURCE_REGISTRY } from "./registry";
import { sourceRegistryEntrySchema } from "./types";

describe("source registry", () => {
  it("contains valid, uniquely keyed current source metadata", () => {
    expect(SOURCE_REGISTRY.length).toBeGreaterThanOrEqual(35);
    expect(new Set(SOURCE_REGISTRY.map((source) => source.slug)).size).toBe(SOURCE_REGISTRY.length);
    for (const source of SOURCE_REGISTRY) {
      expect(sourceRegistryEntrySchema.safeParse(source).success).toBe(true);
      expect(source.lastVerifiedAt).toBe("2026-07-21");
      expect(new URL(source.canonicalUrl).protocol).toBe("https:");
    }
  });

  it("records cervical and vaccine version boundaries without activating a draft", () => {
    expect(getSourceBySlug("uspstf-cervical-cancer-screening-2018")).toMatchObject({
      active: true,
      lifecycle: "current",
      publishedAt: "2018-08-21",
    });
    expect(getSourceBySlug("uspstf-cervical-cancer-screening-draft-2024")).toMatchObject({
      active: false,
      lifecycle: "draft",
    });
    expect(getSourceBySlug("hrsa-womens-preventive-services-guidelines-2026-future")).toMatchObject(
      {
        lifecycle: "future",
        effectiveAt: "2027-01-01",
      },
    );
    expect(getSourceBySlug("cdc-adult-immunization-schedule-2025-operative")?.sourceVersion).toBe(
      "operative-2025-07-02",
    );
    expect(getSourceBySlug("cdc-adult-immunization-addendum-rsv-2026")?.serviceSlugs).toEqual([
      "rsv-vaccine",
    ]);
  });

  it("requires MyHealthfinder attribution and hides reviewer notes publicly", () => {
    const source = getSourceBySlug("myhealthfinder-consumer-content-v4");
    expect(source?.attribution).toMatchObject({
      required: true,
      contentMustRemainUnaltered: true,
    });
    expect(source).not.toBeNull();
    if (source === null) return;
    expect(getPublicSourceMetadata(source)).not.toHaveProperty("internalReviewerNote");
  });
});
