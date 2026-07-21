import { describe, expect, it } from "vitest";

import {
  applyTabularCells,
  bulkRowsToCsv,
  createBulkEntryRow,
  validateBulkEntryRow,
} from "./bulk-entry-utils";

const catalog = [
  {
    slug: "colorectal-screening",
    name: "Colorectal screening",
    methods: [{ slug: "fit", name: "FIT" }],
  },
];

describe("bulk history entry helpers", () => {
  it("pastes tabular rows in documented column order and preserves approximate dates", () => {
    const rows = applyTabularCells(
      [createBulkEntryRow()],
      [
        "colorectal-screening\tfit\t2024\tyear\tnormal\tClinic A\tmedical_record\tFrom chart",
        "Colorectal screening\tFIT\t\tunknown\tunknown\t\tuser_memory\tDate not remembered",
      ].join("\n"),
      0,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      service: "colorectal-screening",
      method: "fit",
      date: "2024",
      datePrecision: "year",
      provider: "Clinic A",
      source: "medical_record",
    });
    expect(rows[1]).toMatchObject({
      service: "Colorectal screening",
      date: "",
      datePrecision: "unknown",
      result: "unknown",
    });
  });

  it("reports service, method, and precision errors at row level", () => {
    const row = createBulkEntryRow({
      service: "Colorectal screening",
      method: "mammogram",
      date: "2024-04",
      datePrecision: "day",
    });

    expect(validateBulkEntryRow(row, catalog)).toEqual([
      "Use a method that belongs to the selected service.",
      "Use YYYY-MM-DD for an exact date.",
    ]);
  });

  it("does not silently replace unsupported pasted select values", () => {
    const [row] = applyTabularCells(
      [createBulkEntryRow()],
      "colorectal-screening\tfit\t2024\tdecade\tpending\tClinic A\tportal\tFrom chart",
      0,
    );

    expect(row).toMatchObject({ datePrecision: "decade", result: "pending", source: "portal" });
    expect(validateBulkEntryRow(row!, catalog)).toEqual([
      "Date precision must be day, month, year, or unknown.",
      "Result is not an accepted value.",
      "Source is not an accepted value.",
    ]);
  });

  it("creates the supported CSV contract without changing edited cell content", () => {
    const csv = bulkRowsToCsv([
      createBulkEntryRow({
        service: "colorectal-screening",
        method: "fit",
        date: "2025-03",
        datePrecision: "month",
        result: "normal",
        provider: "Clinic, West",
        source: "medical_record",
        notes: 'Patient said "done"',
      }),
    ]);

    expect(csv.split("\r\n")[0]).toBe(
      "service,method,date,date_precision,result,provider,location,source,notes",
    );
    expect(csv).toContain('"Clinic, West"');
    expect(csv).toContain('"Patient said ""done"""');
  });
});
