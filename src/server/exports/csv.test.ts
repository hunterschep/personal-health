import { describe, expect, it } from "vitest";

import { createCsv, safeCsvCell } from "./csv";

describe("export CSV safety", () => {
  it.each([
    "=SUM(A1:A2)",
    "+cmd",
    "-2+3",
    "@external",
    "\tformula",
    "\rformula",
    "   =SUM(A1:A2)",
    "\n\t@external",
  ])("neutralizes spreadsheet formula prefix %s", (value) => {
    expect(safeCsvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`);
  });

  it("quotes commas, newlines, and double quotes", () => {
    expect(createCsv(["note"], [['line 1, "quoted"\nline 2']])).toBe(
      '"note"\r\n"line 1, ""quoted""\nline 2"',
    );
  });
});
