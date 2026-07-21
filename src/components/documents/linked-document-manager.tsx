"use client";

import { FileText, LoaderCircle, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { DocumentActions } from "@/components/records/document-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export type LinkedDocumentItem = {
  id: string;
  filename: string;
  mimeType: string;
};

type LinkTarget =
  | { medicationId: string; clinicianOverrideId?: never }
  | { medicationId?: never; clinicianOverrideId: string };

export function LinkedDocumentManager({
  profileId,
  documents,
  editable,
  label,
  ...target
}: {
  profileId: string;
  documents: LinkedDocumentItem[];
  editable: boolean;
  label: string;
} & LinkTarget) {
  const inputId = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editable) return;
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    if (target.medicationId !== undefined) formData.set("medicationId", target.medicationId);
    if (target.clinicianOverrideId !== undefined) {
      formData.set("clinicianOverrideId", target.clinicianOverrideId);
    }
    formData.set("label", label);
    try {
      const response = await fetch(`/api/profiles/${profileId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "The document could not be attached.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be attached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-line mt-4 rounded-xl border p-3">
      <p className="inline-flex items-center gap-2 text-sm font-semibold">
        <Paperclip aria-hidden="true" className="text-brand size-4" /> Private attachments
      </p>
      {documents.length === 0 ? (
        <p className="text-ink-soft mt-2 text-xs">No document attached.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="bg-surface-muted flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{document.filename}</span>
              </span>
              <DocumentActions
                documentId={document.id}
                filename={document.filename}
                editable={editable}
              />
            </div>
          ))}
        </div>
      )}
      {editable ? (
        <form
          onSubmit={(event) => void upload(event)}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <Input
            id={inputId}
            name="file"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png"
            aria-label={`Attach a private document to ${label}`}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Paperclip aria-hidden="true" />
            )}
            {busy ? "Attaching…" : "Attach"}
          </Button>
        </form>
      ) : null}
      {error === undefined ? null : (
        <p className="text-rose mt-2 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
