"use client";

import { AlertTriangle, Check, Download, FileUp } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/form";

type Preview = {
  token: string;
  rows: Array<{
    row: number;
    service: string;
    date: string;
    status: "valid" | "warning" | "error";
    message: string;
    errors: string[];
    warnings: string[];
    possibleDuplicateIds: string[];
  }>;
};

export function CsvImport({ profileId }: { profileId: string }) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [selectedWarningRows, setSelectedWarningRows] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function previewFile() {
    if (file === undefined) return;
    setLoading(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/profiles/${profileId}/import/preview`, {
        method: "POST",
        body,
      });
      const result = (await response.json()) as Preview & { error?: string };
      if (!response.ok) setError(result.error ?? "The CSV could not be previewed.");
      else {
        setPreview(result);
        setSelectedWarningRows(new Set());
      }
    } catch {
      setError("The CSV could not be previewed.");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (preview === undefined) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/profiles/${profileId}/import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: preview.token,
          includeWarningRowNumbers: [...selectedWarningRows],
        }),
      });
      if (response.ok) window.location.assign(`/app/profile/${profileId}/records?imported=true`);
      else setError("The import could not be committed. No rows were saved.");
    } catch {
      setError("The import could not be committed. No rows were saved.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-editorial text-2xl font-semibold">1. Choose a CSV file</h2>
              <p className="text-ink-soft mt-2 max-w-xl text-sm leading-6">
                Files are parsed on the server, limited in size and rows, and removed after the
                import. Nothing is committed until you approve the preview.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <a href={`/api/profiles/${profileId}/import/template`} download>
                <Download aria-hidden="true" /> Template
              </a>
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-2 text-sm font-semibold">
              CSV file
              <Input
                type="file"
                accept="text/csv,.csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0]);
                  setPreview(undefined);
                  setSelectedWarningRows(new Set());
                  setError(undefined);
                }}
              />
            </label>
            <Button type="button" disabled={file === undefined || loading} onClick={previewFile}>
              <FileUp aria-hidden="true" /> {loading ? "Checking…" : "Preview import"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {error !== undefined ? (
        <Alert tone="error" title="Import could not continue">
          {error}
        </Alert>
      ) : null}
      {preview !== undefined ? (
        <Card>
          <CardContent>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-editorial text-2xl font-semibold">2. Review every row</h2>
                <p className="text-ink-soft mt-2 text-sm">
                  Valid rows are included automatically. Every warning or possible duplicate stays
                  out unless you select it below.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge tone="brand">
                  {preview.rows.filter((row) => row.status === "valid").length} valid
                </Badge>
                <Badge tone="warm">
                  {preview.rows.filter((row) => row.status === "warning").length} warnings
                </Badge>
                <Badge tone="critical">
                  {preview.rows.filter((row) => row.status === "error").length} errors
                </Badge>
              </div>
            </div>
            <div className="border-line mt-5 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">CSV import preview</caption>
                <thead className="bg-surface-muted text-ink-soft text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3">Row</th>
                    <th className="p-3">Include</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td className="p-3">{row.row}</td>
                      <td className="p-3">
                        {row.status === "warning" ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              className="accent-brand size-4"
                              aria-label={`Include warning row ${row.row}`}
                              checked={selectedWarningRows.has(row.row)}
                              onChange={(event) =>
                                setSelectedWarningRows((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(row.row);
                                  else next.delete(row.row);
                                  return next;
                                })
                              }
                            />
                            Select
                          </label>
                        ) : (
                          <span className="text-ink-soft text-xs font-semibold">
                            {row.status === "valid" ? "Included" : "Excluded"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold">{row.service}</td>
                      <td className="p-3">{row.date}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2">
                          {row.status === "valid" ? (
                            <Check className="text-brand size-4" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="text-accent size-4" aria-hidden="true" />
                          )}
                          {row.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={commit}
                disabled={
                  loading ||
                  preview.rows.some((row) => row.status === "error") ||
                  preview.rows.filter((row) => row.status === "valid").length +
                    selectedWarningRows.size ===
                    0
                }
              >
                Import selected rows
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
