export const BULK_EDITABLE_FIELDS = [
  "service",
  "method",
  "date",
  "datePrecision",
  "result",
  "provider",
  "source",
  "notes",
] as const;

export type BulkEditableField = (typeof BULK_EDITABLE_FIELDS)[number];

export type BulkCatalogService = {
  slug: string;
  name: string;
  methods: Array<{ slug: string; name: string }>;
};

export type BulkRowStatus = {
  kind: "valid" | "warning" | "error";
  messages: string[];
  previewRowNumber: number;
  selected: boolean;
};

export type BulkEntryRow = {
  id: string;
  revision: number;
  service: string;
  method: string;
  date: string;
  datePrecision: string;
  result: string;
  provider: string;
  source: string;
  notes: string;
  status?: BulkRowStatus;
};

let rowSequence = 0;

export function createBulkEntryRow(
  overrides: Partial<Omit<BulkEntryRow, "id" | "revision" | "status">> = {},
  id?: string,
): BulkEntryRow {
  if (id === undefined) rowSequence += 1;
  return {
    id: id ?? `bulk-row-${rowSequence}`,
    revision: 0,
    service: "",
    method: "",
    date: "",
    datePrecision: "day",
    result: "normal",
    provider: "",
    source: "user_memory",
    notes: "",
    ...overrides,
  };
}

export function isBulkEntryRowEmpty(row: BulkEntryRow): boolean {
  return [row.service, row.method, row.date, row.provider, row.notes].every(
    (value) => value.trim() === "",
  );
}

function lookupKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function matchesCatalogValue(value: string, slug: string, name: string): boolean {
  const key = lookupKey(value);
  return key === lookupKey(slug) || key === lookupKey(name);
}

export function validateBulkEntryRow(
  row: BulkEntryRow,
  catalog: readonly BulkCatalogService[],
): string[] {
  const errors: string[] = [];
  const serviceMatches = catalog.filter((service) =>
    matchesCatalogValue(row.service, service.slug, service.name),
  );

  if (row.service.trim() === "") {
    errors.push("Choose or enter a service.");
  } else if (serviceMatches.length !== 1) {
    errors.push("Use a service slug or exact display name from the catalog.");
  }

  const service = serviceMatches[0];
  if (
    row.method.trim() !== "" &&
    service !== undefined &&
    !service.methods.some((method) => matchesCatalogValue(row.method, method.slug, method.name))
  ) {
    errors.push("Use a method that belongs to the selected service.");
  }

  if (!["day", "month", "year", "unknown"].includes(row.datePrecision)) {
    errors.push("Date precision must be day, month, year, or unknown.");
  } else if (row.datePrecision === "unknown") {
    if (row.date.trim() !== "") errors.push("Leave the date blank when its precision is unknown.");
  } else if (row.date.trim() === "") {
    errors.push("Enter a date at the selected precision.");
  } else {
    const pattern =
      row.datePrecision === "day"
        ? /^\d{4}-\d{2}-\d{2}$/
        : row.datePrecision === "month"
          ? /^\d{4}-\d{2}$/
          : /^\d{4}$/;
    if (!pattern.test(row.date.trim())) {
      errors.push(
        row.datePrecision === "day"
          ? "Use YYYY-MM-DD for an exact date."
          : row.datePrecision === "month"
            ? "Use YYYY-MM for a month."
            : "Use YYYY for a year.",
      );
    }
  }

  if (!["normal", "abnormal", "inconclusive", "unknown", "not_applicable"].includes(row.result)) {
    errors.push("Result is not an accepted value.");
  }
  if (
    !["user_memory", "medical_record", "clinician", "pharmacy", "csv_import"].includes(row.source)
  ) {
    errors.push("Source is not an accepted value.");
  }
  if (row.provider.length > 120) errors.push("Provider must be 120 characters or fewer.");
  if (row.notes.length > 2_000) errors.push("Notes must be 2,000 characters or fewer.");
  return errors;
}

export function parseTabularCells(text: string): string[][] {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  while (lines.at(-1)?.trim() === "") lines.pop();
  if (lines.length > 1_000) throw new RangeError("Paste no more than 1,000 rows at a time.");
  return lines.filter((line) => line.trim() !== "").map((line) => line.split("\t"));
}

export function applyTabularCells(
  rows: readonly BulkEntryRow[],
  text: string,
  startRow: number,
  startColumn = 0,
  createRow: () => BulkEntryRow = createBulkEntryRow,
): BulkEntryRow[] {
  const matrix = parseTabularCells(text);
  const next = rows.map((row) => ({ ...row }));

  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    const rowIndex = startRow + rowOffset;
    while (next.length <= rowIndex) next.push(createRow());
    const row = next[rowIndex];
    if (row === undefined) continue;
    const cells = matrix[rowOffset] ?? [];
    let changed = false;
    for (let columnOffset = 0; columnOffset < cells.length; columnOffset += 1) {
      const field = BULK_EDITABLE_FIELDS[startColumn + columnOffset];
      if (field === undefined) break;
      const value = cells[columnOffset]?.trim() ?? "";
      if (field === "datePrecision") {
        row.datePrecision = value;
        if (value === "unknown") row.date = "";
      } else {
        row[field] = value;
      }
      changed = true;
    }
    if (changed) {
      row.revision += 1;
      delete row.status;
    }
  }

  return next;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function bulkRowsToCsv(rows: readonly BulkEntryRow[]): string {
  const lines = [
    "service,method,date,date_precision,result,provider,location,source,notes",
    ...rows.map((row) =>
      [
        row.service,
        row.method,
        row.datePrecision === "unknown" ? "" : row.date,
        row.datePrecision,
        row.result,
        row.provider,
        "",
        row.source,
        row.notes,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return lines.join("\r\n");
}
