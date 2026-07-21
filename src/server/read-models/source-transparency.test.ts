import { describe, expect, it } from "vitest";
import { getPublicSourceMetadata, getSourceBySlug } from "@/server/sources/registry";
import { filterSourceCenterRows, type SourceCenterRow } from "./source-transparency";

function colorectalRow(): SourceCenterRow {
  const source = getSourceBySlug("uspstf-colorectal-cancer-screening-2021");
  if (source === null) throw new Error("Missing source fixture.");
  return {
    metadata: getPublicSourceMetadata(source),
    freshness: "current",
    activeRuleCount: 2,
    totalRuleCount: 2,
    hasBaseline: true,
    hasAlternative: false,
    hasRetiredRule: false,
    services: [
      {
        slug: "colorectal-cancer-screening",
        name: "Colorectal cancer screening",
        category: "cancer_screening",
      },
    ],
  };
}

describe("source center filters", () => {
  it("filters across service, source, freshness, and variant metadata", () => {
    const row = colorectalRow();
    expect(
      filterSourceCenterRows([row], {
        query: "colorectal",
        category: "cancer_screening",
        freshness: "current",
        evidence: "uspstf_final",
        variant: "baseline",
        activity: "active",
      }),
    ).toEqual([row]);
    expect(filterSourceCenterRows([row], { variant: "alternative" })).toEqual([]);
    expect(filterSourceCenterRows([row], { organization: "Unknown organization" })).toEqual([]);
  });
});
