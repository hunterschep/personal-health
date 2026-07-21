import { describe, expect, it } from "vitest";

import { filterProfileRecords, type FilterableRecord } from "./record-filters";

function record(overrides: Partial<FilterableRecord> = {}): FilterableRecord {
  return {
    performedStart: new Date("2024-01-01T00:00:00.000Z"),
    performedEnd: new Date("2024-12-31T00:00:00.000Z"),
    datePrecision: "year",
    result: "normal",
    source: "user_memory",
    importBatchId: null,
    providerName: "Dr. Rivera",
    clinicianManaged: false,
    service: { name: "Cervical cancer screening", category: "cancer_screening" },
    method: { name: "HPV test" },
    documentLinks: [],
    ...overrides,
  };
}

describe("record filters", () => {
  it("searches service, method, provider, and year", () => {
    const records = [record()];
    for (const query of ["cervical", "hpv", "rivera", "2024"]) {
      expect(filterProfileRecords(records, { query }, 2026)).toHaveLength(1);
    }
  });

  it("supports category, imported, documents, and missing-date views", () => {
    const imported = record({ source: "csv_import", importBatchId: "batch" });
    expect(
      filterProfileRecords([imported], { category: "cancer_screening", state: "imported" }, 2026),
    ).toEqual([imported]);
    expect(filterProfileRecords([record()], { state: "documents" }, 2026)).toHaveLength(0);
    expect(
      filterProfileRecords(
        [record({ datePrecision: "unknown", performedStart: null, performedEnd: null })],
        { state: "missing-date" },
        2026,
      ),
    ).toHaveLength(1);
  });

  it("combines abnormal results with clinician-managed services", () => {
    expect(
      filterProfileRecords(
        [record({ result: "abnormal" }), record({ clinicianManaged: true })],
        { state: "abnormal-clinician" },
        2026,
      ),
    ).toHaveLength(2);
  });
});
