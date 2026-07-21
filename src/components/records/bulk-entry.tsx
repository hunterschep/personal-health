"use client";

import { ClipboardPaste, FileCheck2, Plus } from "lucide-react";
import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";

import { BulkEntryGridHeader, BulkEntryGridRow } from "./bulk-entry-grid";

import {
  applyTabularCells,
  bulkRowsToCsv,
  createBulkEntryRow,
  isBulkEntryRowEmpty,
  type BulkCatalogService,
  type BulkEditableField,
  type BulkEntryRow,
  validateBulkEntryRow,
} from "./bulk-entry-utils";

type PreviewResponse = {
  token: string;
  rows: Array<{
    row: number;
    status: "valid" | "warning" | "error";
    message: string;
    errors: string[];
    warnings: string[];
  }>;
  error?: string;
};

export function BulkEntry({
  profileId,
  catalog,
}: {
  profileId: string;
  catalog: BulkCatalogService[];
}) {
  const rowIdPrefix = useId().replaceAll(":", "");
  const nextRowSequence = useRef(1);
  const [rows, setRows] = useState<BulkEntryRow[]>(() => [
    createBulkEntryRow({}, `${rowIdPrefix}-0`),
  ]);
  const [batchToken, setBatchToken] = useState<string>();
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [savedMessage, setSavedMessage] = useState<string>();

  const checkedRows = useMemo(
    () => rows.filter((row) => (row.status?.previewRowNumber ?? 0) > 0),
    [rows],
  );
  const saveableRows = checkedRows.filter(
    (row) => row.status?.kind === "valid" || row.status?.selected === true,
  );
  const statusCounts = {
    valid: checkedRows.filter((row) => row.status?.kind === "valid").length,
    warning: checkedRows.filter((row) => row.status?.kind === "warning").length,
    error: checkedRows.filter((row) => row.status?.kind === "error").length,
  };

  function createRow(overrides: Parameters<typeof createBulkEntryRow>[0] = {}): BulkEntryRow {
    const id = `${rowIdPrefix}-${nextRowSequence.current}`;
    nextRowSequence.current += 1;
    return createBulkEntryRow(overrides, id);
  }

  function updateRow(rowId: string, field: BulkEditableField, value: string): void {
    setSavedMessage(undefined);
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const next = {
          ...row,
          [field]: value,
          revision: row.revision + 1,
        } as BulkEntryRow;
        if (field === "datePrecision" && value === "unknown") next.date = "";
        if (field === "service") next.method = "";
        delete next.status;
        return next;
      }),
    );
  }

  function validateRowLocally(rowId: string): void {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId || isBulkEntryRowEmpty(row)) return row;
        const messages = validateBulkEntryRow(row, catalog);
        if (messages.length === 0) return row;
        return {
          ...row,
          status: { kind: "error", messages, previewRowNumber: 0, selected: false },
        };
      }),
    );
  }

  function addRow(): void {
    setRows((current) => [...current, createRow()]);
  }

  function duplicateRow(rowId: string): void {
    setRows((current) => {
      const sourceIndex = current.findIndex((row) => row.id === rowId);
      const source = current[sourceIndex];
      if (source === undefined) return current;
      const duplicate = createRow({
        service: source.service,
        method: source.method,
        date: source.date,
        datePrecision: source.datePrecision,
        result: source.result,
        provider: source.provider,
        source: source.source,
        notes: source.notes,
      });
      const next = [...current];
      next.splice(sourceIndex + 1, 0, duplicate);
      return next;
    });
  }

  function removeRow(rowId: string): void {
    setRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length === 0 ? [createRow()] : next;
    });
  }

  function pasteAt(text: string, rowIndex: number, columnIndex: number): void {
    try {
      setRows((current) => applyTabularCells(current, text, rowIndex, columnIndex, createRow));
      setError(undefined);
      setSavedMessage(undefined);
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : "The pasted rows are not valid.");
    }
  }

  function handleCellPaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ): void {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !/[\r\n]/.test(text)) return;
    event.preventDefault();
    pasteAt(text, rowIndex, columnIndex);
  }

  function addPastedRows(): void {
    if (pasteText.trim() === "") return;
    const lastIndex = rows.length - 1;
    const startRow =
      rows.length === 1 && isBulkEntryRowEmpty(rows[0]!)
        ? 0
        : isBulkEntryRowEmpty(rows[lastIndex]!)
          ? lastIndex
          : rows.length;
    pasteAt(pasteText, startRow, 0);
    setPasteText("");
    setShowPaste(false);
  }

  function handleGridKeyDown(
    event: KeyboardEvent<HTMLElement>,
    rowIndex: number,
    columnIndex: number,
  ): void {
    if (event.key !== "Enter" || event.currentTarget.tagName === "SELECT") return;
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const next = document.querySelector<HTMLElement>(
      `[data-grid-cell="${rowIndex + direction}-${columnIndex}"]`,
    );
    next?.focus();
  }

  async function checkRows(): Promise<void> {
    const snapshot = rows.filter((row) => !isBulkEntryRowEmpty(row));
    if (snapshot.length === 0) {
      setError("Enter at least one care record before checking rows.");
      return;
    }

    setChecking(true);
    setError(undefined);
    setSavedMessage(undefined);
    setRows((current) =>
      current.map((row) => {
        const messages = validateBulkEntryRow(row, catalog);
        return isBulkEntryRowEmpty(row) || messages.length === 0
          ? row
          : {
              ...row,
              status: { kind: "error", messages, previewRowNumber: 0, selected: false },
            };
      }),
    );

    try {
      const body = new FormData();
      body.set(
        "file",
        new File([bulkRowsToCsv(snapshot)], "bulk-care-history.csv", { type: "text/csv" }),
      );
      const response = await fetch(`/api/profiles/${profileId}/import/preview`, {
        method: "POST",
        body,
      });
      const result = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        setError(result.error ?? "The rows could not be checked.");
        return;
      }

      const snapshotByPreviewRow = new Map(
        snapshot.map((row, index) => [index + 2, { id: row.id, revision: row.revision }]),
      );
      const resultById = new Map(
        result.rows.flatMap((previewRow) => {
          const snapshotRow = snapshotByPreviewRow.get(previewRow.row);
          return snapshotRow === undefined ? [] : [[snapshotRow.id, { previewRow, snapshotRow }]];
        }),
      );
      setRows((current) =>
        current.map((row) => {
          const entry = resultById.get(row.id);
          if (entry === undefined || entry.snapshotRow.revision !== row.revision) return row;
          const messages =
            entry.previewRow.status === "error"
              ? entry.previewRow.errors
              : entry.previewRow.status === "warning"
                ? entry.previewRow.warnings
                : ["Ready to save."];
          return {
            ...row,
            status: {
              kind: entry.previewRow.status,
              messages,
              previewRowNumber: entry.previewRow.row,
              selected: entry.previewRow.status === "valid",
            },
          };
        }),
      );
      setBatchToken(result.token);
    } catch {
      setError("The rows could not be checked. Your entries are still here.");
    } finally {
      setChecking(false);
    }
  }

  function chooseWarning(rowId: string, selected: boolean): void {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && row.status?.kind === "warning"
          ? { ...row, status: { ...row.status, selected } }
          : row,
      ),
    );
  }

  async function saveRows(): Promise<void> {
    if (batchToken === undefined || saveableRows.length === 0) return;
    setSaving(true);
    setError(undefined);
    setSavedMessage(undefined);
    const selectedRowNumbers = saveableRows.flatMap((row) =>
      row.status === undefined ? [] : [row.status.previewRowNumber],
    );
    const savedRevisions = new Map(saveableRows.map((row) => [row.id, row.revision]));
    try {
      const response = await fetch(`/api/profiles/${profileId}/import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: batchToken, includeRowNumbers: selectedRowNumbers }),
      });
      const result = (await response.json()) as { importedCount?: number; error?: string };
      if (!response.ok) {
        setError(result.error ?? "No rows were saved. Your entries are still here.");
        return;
      }

      setRows((current) => {
        const remaining = current
          .filter((row) => savedRevisions.get(row.id) !== row.revision)
          .map((row) =>
            row.status === undefined
              ? row
              : { ...row, status: { ...row.status, previewRowNumber: 0, selected: false } },
          );
        return remaining.length === 0 ? [createRow()] : remaining;
      });
      setBatchToken(undefined);
      const count = result.importedCount ?? saveableRows.length;
      setSavedMessage(
        `${count} ${count === 1 ? "record" : "records"} saved. Any unfinished rows remain below.`,
      );
    } catch {
      setError("No rows were saved. Your entries are still here.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-editorial text-2xl font-semibold">Build your history sheet</h2>
              <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
                Tab moves across fields. Enter moves down the same column. Use catalog names or
                stable slugs; approximate dates stay approximate.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowPaste((open) => !open)}>
              <ClipboardPaste aria-hidden="true" /> Paste rows
            </Button>
          </div>

          {showPaste ? (
            <div className="border-brand/25 bg-brand-soft/55 rounded-2xl border p-4">
              <label className="block text-sm font-semibold" htmlFor="bulk-paste">
                Paste spreadsheet rows
              </label>
              <p className="text-ink-soft mt-1 text-xs leading-5">
                Column order: service, method, date, precision, result, provider, source, notes.
              </p>
              <Textarea
                id="bulk-paste"
                className="mt-3 min-h-28 font-mono text-xs"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={
                  "colorectal-screening\tfit\t2025-03\tmonth\tnormal\tExample Clinic\tmedical_record\tFrom chart"
                }
              />
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={pasteText.trim() === ""}
                  onClick={addPastedRows}
                >
                  Add pasted rows
                </Button>
              </div>
            </div>
          ) : null}

          {error !== undefined ? (
            <Alert tone="error" title="Could not continue">
              {error}
            </Alert>
          ) : null}
          {savedMessage !== undefined ? (
            <Alert tone="success" title="History updated">
              {savedMessage}{" "}
              <a className="font-semibold underline" href={`/app/profile/${profileId}/records`}>
                View care records
              </a>
            </Alert>
          ) : null}
        </CardContent>

        <div className="lg:border-line lg:overflow-x-auto lg:border-t">
          <div
            role="table"
            aria-label="Bulk care history entry"
            className="space-y-3 px-4 pb-5 lg:min-w-[112rem] lg:space-y-0 lg:px-0 lg:pb-0"
          >
            <BulkEntryGridHeader />
            {rows.map((row, rowIndex) => (
              <BulkEntryGridRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                catalog={catalog}
                onChange={updateRow}
                onBlur={validateRowLocally}
                onPaste={handleCellPaste}
                onKeyDown={handleGridKeyDown}
                onDuplicate={duplicateRow}
                onRemove={removeRow}
                onChooseWarning={chooseWarning}
              />
            ))}
          </div>
        </div>

        <datalist id="bulk-service-options">
          {catalog.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.name}
            </option>
          ))}
        </datalist>

        <CardContent className="border-line space-y-5 border-t">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="secondary" onClick={addRow}>
              <Plus aria-hidden="true" /> Add row
            </Button>
            {checkedRows.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Row validation summary">
                <Badge tone="brand">{statusCounts.valid} ready</Badge>
                <Badge tone="warm">{statusCounts.warning} warnings</Badge>
                <Badge tone="critical">{statusCounts.error} errors</Badge>
              </div>
            ) : null}
          </div>
          <div className="border-line flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={checking || saving}
              onClick={() => void checkRows()}
            >
              <FileCheck2 aria-hidden="true" /> {checking ? "Checking rows…" : "Check rows"}
            </Button>
            <Button
              type="button"
              disabled={batchToken === undefined || saveableRows.length === 0 || checking || saving}
              onClick={() => void saveRows()}
            >
              {saving
                ? "Saving and recalculating…"
                : `Save ${saveableRows.length} valid ${saveableRows.length === 1 ? "row" : "rows"}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
