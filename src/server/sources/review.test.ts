import { describe, expect, it } from "vitest";

import { parseSourceReviewCommand, sourceReviewAuditData } from "./review";

describe("source review maintenance command", () => {
  it("builds a value-free database audit record for a review decision", () => {
    const audit = sourceReviewAuditData("source-id", "rejected");

    expect(audit).toEqual({
      action: "source.content_reviewed",
      entityType: "GuidelineSource",
      entityId: "source-id",
      metadataJson: { decision: "rejected" },
    });
    expect(JSON.stringify(audit)).not.toMatch(/reviewer|note|cache/i);
  });

  it("parses a complete deterministic persisted decision", () => {
    expect(
      parseSourceReviewCommand(
        [
          "--source",
          "myhealthfinder-consumer-content-v4",
          "--cache-key",
          "myhealthfinder:v4:hash",
          "--decision",
          "approved",
          "--reviewer",
          "Synthetic Maintainer",
          "--note",
          "Reviewed against the registered source.",
          "--file-cache",
        ],
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toEqual({
      sourceSlug: "myhealthfinder-consumer-content-v4",
      cacheKey: "myhealthfinder:v4:hash",
      fileCache: true,
      decision: {
        decision: "approved",
        reviewer: "Synthetic Maintainer",
        reviewedAt: "2026-07-21T12:00:00.000Z",
        note: "Reviewed against the registered source.",
      },
    });
  });

  it("requires the source, cache key, reviewer, and a known decision", () => {
    expect(() => parseSourceReviewCommand([])).toThrow("--source is required");
    expect(() =>
      parseSourceReviewCommand([
        "--source",
        "source",
        "--cache-key",
        "key",
        "--reviewer",
        "reviewer",
        "--decision",
        "maybe",
      ]),
    ).toThrow();
  });
});
