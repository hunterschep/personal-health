export type PackYearPreview =
  { packYears: number; detail: string } | { packYears: null; detail: string };

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A transparent estimate for the single smoking period captured by the compact profile form. */
export function packYearPreview(
  input: {
    status: "never" | "current" | "former" | "unknown" | "prefer_not_to_answer";
    startedYear: string | number | null | undefined;
    endedYear: string | number | null | undefined;
    packsPerDay: string | number | null | undefined;
  },
  currentYear = new Date().getFullYear(),
): PackYearPreview {
  if (input.status !== "current" && input.status !== "former") {
    return { packYears: null, detail: "No pack-year estimate is needed for this answer." };
  }
  const startedYear = finiteNumber(input.startedYear);
  const packsPerDay = finiteNumber(input.packsPerDay);
  if (startedYear === null || packsPerDay === null) {
    return {
      packYears: null,
      detail: "Add a start year and average packs per day to preview pack-years.",
    };
  }
  const endedYear = input.status === "current" ? currentYear : finiteNumber(input.endedYear);
  if (endedYear === null) {
    return {
      packYears: null,
      detail: "Add an approximate quit year to preview pack-years.",
    };
  }
  if (endedYear < startedYear) {
    return { packYears: null, detail: "The quit year must not be before the start year." };
  }
  const packYears = Math.round((endedYear - startedYear) * packsPerDay * 10) / 10;
  return {
    packYears,
    detail:
      input.status === "current"
        ? `Estimated through ${currentYear}; year-only dates and average use make this approximate.`
        : "Year-only dates and average use make this estimate approximate.",
  };
}
