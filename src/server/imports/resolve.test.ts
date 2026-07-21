import { describe, expect, it } from "vitest";

import type { NormalizedImportRow } from "./types";
import { resolveImportRows } from "./resolve";

const serviceId = "10000000-0000-4000-8000-000000000001";
const methodId = "10000000-0000-4000-8000-000000000002";

function row(overrides: Partial<NormalizedImportRow> = {}): NormalizedImportRow {
  return {
    rowNumber: 2,
    service: "Colorectal screening",
    method: "FIT",
    date: "2025",
    datePrecision: "year",
    result: "normal",
    provider: " Example   Clinic ",
    location: null,
    source: "csv_import",
    notes: null,
    performedStart: "2025-01-01",
    performedEnd: "2025-12-31",
    serviceId: null,
    methodId: null,
    errors: [],
    warnings: [],
    possibleDuplicateIds: [],
    ...overrides,
  };
}

describe("CSV catalog and duplicate resolution", () => {
  const services = [
    {
      id: serviceId,
      slug: "colorectal-screening",
      name: "Colorectal screening",
      methods: [{ id: methodId, slug: "fit", name: "FIT" }],
    },
  ];

  it("resolves exact display names and finds overlapping duplicates", () => {
    const rows = resolveImportRows([row()], services, [
      {
        id: "event-1",
        serviceId,
        methodId,
        performedStart: new Date("2025-06-01T00:00:00.000Z"),
        performedEnd: new Date("2025-06-01T00:00:00.000Z"),
        providerName: "example clinic",
      },
    ]);

    expect(rows[0]).toMatchObject({
      serviceId,
      methodId,
      possibleDuplicateIds: ["event-1"],
    });
    expect(rows[0]?.warnings).toContain("A similar care event already exists for this profile.");
  });

  it("does not reveal unrelated catalog entries in lookup errors", () => {
    const rows = resolveImportRows([row({ service: "private-service" })], services, []);
    expect(rows[0]?.errors).toEqual([
      "Service was not recognized. Use a catalog slug or exact display name.",
    ]);
  });

  it("warns about duplicates inside the same preview", () => {
    const rows = resolveImportRows([row(), row({ rowNumber: 3 })], services, []);
    expect(rows[1]?.warnings).toContain("This appears to duplicate CSV row 2.");
  });
});
