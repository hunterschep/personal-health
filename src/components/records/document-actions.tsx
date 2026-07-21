"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DocumentActions({
  documentId,
  filename,
  editable,
}: {
  documentId: string;
  filename: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function remove(): Promise<void> {
    if (!window.confirm(`Permanently delete ${filename}? This cannot be undone.`)) return;
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "The document could not be deleted.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <div className="flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/api/documents/${documentId}`}>
            <Download aria-hidden="true" /> Download
          </a>
        </Button>
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden="true" /> {busy ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
      </div>
      {error !== undefined ? (
        <p className="text-rose mt-1 text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
