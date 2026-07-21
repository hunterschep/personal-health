import { describe, expect, it } from "vitest";

import { csvTemplate, decodeCsv, parseCsv } from "./csv";
import { CSV_HEADERS, MAX_CSV_ROWS } from "./types";

describe("CSV care-event parsing", () => {
  it("normalizes approximate dates without inventing an exact day", () => {
    const rows = parseCsv(
      [
        "service,method,date,date_precision,result,provider,location,source,notes",
        "colorectal-screening,fit,2024,year,normal,Clinic,,medical_record,recorded from chart",
      ].join("\n"),
      "2026-07-21",
    );

    expect(rows[0]).toMatchObject({
      performedStart: "2024-01-01",
      performedEnd: "2024-12-31",
      datePrecision: "year",
      errors: [],
    });
  });

  it("rejects formula-like content as data", () => {
    const rows = parseCsv(
      [
        "service,method,date,date_precision,result,provider,location,source,notes",
        'colorectal-screening,fit,2024-04-01,day,normal,=HYPERLINK("bad"),,medical_record,note',
      ].join("\n"),
      "2026-07-21",
    );

    expect(rows[0]?.errors).toContain("Formula-like cell content is not accepted.");
  });

  it("rejects future completed dates", () => {
    const rows = parseCsv(
      [
        "service,method,date,date_precision,result,provider,location,source,notes",
        "colorectal-screening,fit,2027,year,normal,,,medical_record,",
      ].join("\n"),
      "2026-07-21",
    );

    expect(rows[0]?.errors).toContain("Completed care dates cannot be in the future.");
  });

  it("accepts approximate dates in the current month or year", () => {
    const rows = parseCsv(
      [
        "service,method,date,date_precision,result,provider,location,source,notes",
        "colorectal-screening,fit,2026,year,normal,,,medical_record,",
        "breast-screening,mammogram,2026-07,month,normal,,,medical_record,",
      ].join("\n"),
      "2026-07-21",
    );
    expect(rows.map((row) => row.errors)).toEqual([[], []]);
  });

  it("rejects non-UTF-8 input and emits the documented headers", () => {
    expect(() => decodeCsv(Uint8Array.from([0xff, 0xfe, 0x41, 0x00]))).toThrow(/UTF-8/);
    expect(csvTemplate().split("\r\n")[0]).toBe(
      "service,method,date,date_precision,result,provider,location,source,notes",
    );
  });

  it("accepts the documented row limit and rejects one additional row", () => {
    const row = "colorectal-screening,fit,2024-04-01,day,normal,,,csv_import,";
    const atLimit = [CSV_HEADERS.join(","), ...Array.from({ length: MAX_CSV_ROWS }, () => row)];

    expect(parseCsv(atLimit.join("\n"), "2026-07-21")).toHaveLength(MAX_CSV_ROWS);
    expect(() => parseCsv([...atLimit, row].join("\n"), "2026-07-21")).toThrow(
      `CSV imports are limited to ${MAX_CSV_ROWS.toLocaleString("en-US")} rows.`,
    );
  });
});
