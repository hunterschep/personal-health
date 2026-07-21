export type RecordFilterInput = {
  query?: string;
  year?: string;
  state?: string;
  category?: string;
};

export type FilterableRecord = {
  performedStart: Date | null;
  performedEnd: Date | null;
  datePrecision: string;
  result: string;
  source: string;
  importBatchId: string | null;
  providerName: string | null;
  clinicianManaged: boolean;
  service: { name: string; category: string };
  method: { name: string } | null;
  documentLinks: readonly unknown[];
};

export function filterProfileRecords<T extends FilterableRecord>(
  records: readonly T[],
  filters: RecordFilterInput,
  currentYear: number,
): T[] {
  const query = filters.query?.trim().toLocaleLowerCase("en-US") ?? "";
  return records.filter((record) => {
    const startYear = record.performedStart?.getUTCFullYear();
    const endYear = record.performedEnd?.getUTCFullYear();
    const searchable = [
      record.service.name,
      record.method?.name,
      record.providerName,
      startYear,
      endYear,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLocaleLowerCase("en-US");
    if (query !== "" && !searchable.includes(query)) return false;
    if (filters.category !== undefined && filters.category !== "all") {
      if (record.service.category !== filters.category) return false;
    }
    if (filters.year !== undefined && filters.year !== "all") {
      if (
        filters.year === "older"
          ? startYear === undefined || startYear >= currentYear - 1
          : String(startYear) !== filters.year
      ) {
        return false;
      }
    }
    if (filters.state === "missing-date" && record.datePrecision !== "unknown") return false;
    if (filters.state === "documents" && record.documentLinks.length === 0) return false;
    if (
      filters.state === "abnormal-clinician" &&
      record.result !== "abnormal" &&
      record.result !== "inconclusive" &&
      !record.clinicianManaged
    ) {
      return false;
    }
    if (
      filters.state === "imported" &&
      record.source !== "csv_import" &&
      record.importBatchId === null
    ) {
      return false;
    }
    return true;
  });
}
