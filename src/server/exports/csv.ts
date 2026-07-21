const FORMULA_PREFIX = /^(?:\s*[=+\-@]|[\t\r])/;

export function safeCsvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);

  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  return [
    headers.map(safeCsvCell).join(","),
    ...rows.map((row) => row.map(safeCsvCell).join(",")),
  ].join("\r\n");
}
