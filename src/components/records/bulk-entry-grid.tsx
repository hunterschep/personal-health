import { AlertTriangle, Check, CopyPlus, Paperclip, Trash2 } from "lucide-react";
import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

import type { BulkCatalogService, BulkEditableField, BulkEntryRow } from "./bulk-entry-utils";

const GRID_COLUMNS =
  "lg:grid-cols-[3rem_13rem_11rem_9.5rem_8.5rem_9.5rem_11rem_10rem_15rem_8rem_5.5rem]";

function catalogMatch(value: string, slug: string, name: string): boolean {
  const key = value.trim().toLocaleLowerCase("en-US");
  return key === slug.toLocaleLowerCase("en-US") || key === name.toLocaleLowerCase("en-US");
}

function rowMessages(row: BulkEntryRow): ReactNode {
  const status = row.status;
  if (status === undefined) {
    return <span className="text-ink-soft">Not checked yet</span>;
  }
  const Icon = status.kind === "valid" ? Check : AlertTriangle;
  return (
    <span
      className={
        status.kind === "error"
          ? "text-rose"
          : status.kind === "warning"
            ? "text-accent-strong"
            : "text-brand-strong"
      }
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Icon aria-hidden="true" className="size-4" />
        {status.kind === "valid"
          ? "Ready to save"
          : status.kind === "warning"
            ? "Needs a decision"
            : "Fix this row"}
      </span>
      {status.kind !== "valid" ? (
        <span className="mt-1 block">{status.messages.join(" ")}</span>
      ) : null}
    </span>
  );
}

export function BulkEntryGridHeader() {
  return (
    <div
      role="row"
      className={`bg-surface-muted text-ink-soft hidden items-center gap-2 px-3 py-3 text-[0.68rem] font-bold tracking-wider uppercase lg:grid ${GRID_COLUMNS}`}
    >
      {[
        "Row",
        "Service",
        "Method",
        "Date",
        "Precision",
        "Result",
        "Provider",
        "Source",
        "Notes",
        "Attachment",
        "Actions",
      ].map((heading) => (
        <div role="columnheader" key={heading}>
          {heading}
        </div>
      ))}
    </div>
  );
}

export function BulkEntryGridRow({
  row,
  rowIndex,
  catalog,
  onChange,
  onBlur,
  onPaste,
  onKeyDown,
  onDuplicate,
  onRemove,
  onChooseWarning,
}: {
  row: BulkEntryRow;
  rowIndex: number;
  catalog: BulkCatalogService[];
  onChange: (rowId: string, field: BulkEditableField, value: string) => void;
  onBlur: (rowId: string) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => void;
  onDuplicate: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onChooseWarning: (rowId: string, selected: boolean) => void;
}) {
  const selectedService = catalog.find((service) =>
    catalogMatch(row.service, service.slug, service.name),
  );
  const fieldProps = (column: number) => ({
    "data-grid-cell": `${rowIndex}-${column}`,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, rowIndex, column),
  });

  return (
    <div
      role="row"
      className={`border-line bg-surface-raised grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-2 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:p-3 lg:shadow-none ${GRID_COLUMNS}`}
    >
      <div role="cell" className="flex items-center justify-between sm:col-span-2 lg:col-span-1">
        <span className="text-ink-soft text-xs font-bold tracking-wider uppercase lg:hidden">
          Row
        </span>
        <Badge>{rowIndex + 1}</Badge>
      </div>
      <label role="cell" className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Service</span>
        <Input
          {...fieldProps(0)}
          aria-label={`Row ${rowIndex + 1} service`}
          list="bulk-service-options"
          value={row.service}
          onChange={(event) => onChange(row.id, "service", event.target.value)}
          onBlur={() => onBlur(row.id)}
          onPaste={(event) => onPaste(event, rowIndex, 0)}
          placeholder="Service name or slug"
        />
      </label>
      <label role="cell" className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Method</span>
        <Input
          {...fieldProps(1)}
          aria-label={`Row ${rowIndex + 1} method`}
          list={`bulk-method-options-${row.id}`}
          value={row.method}
          onChange={(event) => onChange(row.id, "method", event.target.value)}
          onBlur={() => onBlur(row.id)}
          onPaste={(event) => onPaste(event, rowIndex, 1)}
          placeholder="Optional"
        />
        <datalist id={`bulk-method-options-${row.id}`}>
          {selectedService?.methods.map((method) => (
            <option key={method.slug} value={method.slug}>
              {method.name}
            </option>
          ))}
        </datalist>
      </label>
      <label role="cell" className="space-y-1.5">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Date</span>
        <Input
          {...fieldProps(2)}
          aria-label={`Row ${rowIndex + 1} date`}
          type={
            row.datePrecision === "day" ? "date" : row.datePrecision === "month" ? "month" : "text"
          }
          inputMode={row.datePrecision === "year" ? "numeric" : undefined}
          maxLength={row.datePrecision === "year" ? 4 : undefined}
          disabled={row.datePrecision === "unknown"}
          value={row.date}
          onChange={(event) => onChange(row.id, "date", event.target.value)}
          onBlur={() => onBlur(row.id)}
          onPaste={(event) => onPaste(event, rowIndex, 2)}
          placeholder={row.datePrecision === "year" ? "YYYY" : "Date unknown"}
        />
      </label>
      <label role="cell" className="space-y-1.5">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Precision</span>
        <Select
          {...fieldProps(3)}
          aria-label={`Row ${rowIndex + 1} precision`}
          value={row.datePrecision}
          onChange={(event) => onChange(row.id, "datePrecision", event.target.value)}
          onBlur={() => onBlur(row.id)}
        >
          <option value="day">Exact day</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
          <option value="unknown">Unknown</option>
        </Select>
      </label>
      <label role="cell" className="space-y-1.5">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Result</span>
        <Select
          {...fieldProps(4)}
          aria-label={`Row ${rowIndex + 1} result`}
          value={row.result}
          onChange={(event) => onChange(row.id, "result", event.target.value)}
        >
          <option value="normal">Normal / routine</option>
          <option value="abnormal">Abnormal</option>
          <option value="inconclusive">Inconclusive</option>
          <option value="unknown">Not sure</option>
          <option value="not_applicable">Not applicable</option>
        </Select>
      </label>
      <label role="cell" className="space-y-1.5">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Provider</span>
        <Input
          {...fieldProps(5)}
          aria-label={`Row ${rowIndex + 1} provider`}
          maxLength={120}
          value={row.provider}
          onChange={(event) => onChange(row.id, "provider", event.target.value)}
          onPaste={(event) => onPaste(event, rowIndex, 5)}
          placeholder="Optional"
        />
      </label>
      <label role="cell" className="space-y-1.5">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Source</span>
        <Select
          {...fieldProps(6)}
          aria-label={`Row ${rowIndex + 1} source`}
          value={row.source}
          onChange={(event) => onChange(row.id, "source", event.target.value)}
        >
          <option value="user_memory">My memory</option>
          <option value="medical_record">Medical record</option>
          <option value="clinician">Clinician</option>
          <option value="pharmacy">Pharmacy</option>
        </Select>
      </label>
      <label role="cell" className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <span className="text-ink-soft text-xs font-semibold lg:hidden">Notes</span>
        <Input
          {...fieldProps(7)}
          aria-label={`Row ${rowIndex + 1} notes`}
          maxLength={2_000}
          value={row.notes}
          onChange={(event) => onChange(row.id, "notes", event.target.value)}
          onPaste={(event) => onPaste(event, rowIndex, 7)}
          placeholder="Optional context"
        />
      </label>
      <div role="cell" className="flex items-center gap-2 text-xs">
        <Paperclip aria-hidden="true" className="text-ink-soft size-4" />
        <span>
          <span className="text-ink-soft font-semibold lg:hidden">Attachment: </span>
          Add after save
        </span>
      </div>
      <div role="cell" className="flex items-center justify-end gap-1 lg:justify-start">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Duplicate row ${rowIndex + 1}`}
          onClick={() => onDuplicate(row.id)}
        >
          <CopyPlus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove row ${rowIndex + 1}`}
          onClick={() => onRemove(row.id)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <div
        role="cell"
        className="border-line text-sm sm:col-span-2 lg:col-span-full lg:border-t lg:pt-3"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>{rowMessages(row)}</div>
          {row.status?.kind === "warning" && row.status.previewRowNumber > 0 ? (
            <label className="border-accent/30 bg-accent-soft flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={row.status.selected}
                onChange={(event) => onChooseWarning(row.id, event.target.checked)}
              />
              Save this row despite the warning
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
