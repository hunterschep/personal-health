"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form";

export function ProfileDeletionForm({
  profileId,
  profileName,
}: {
  profileId: string;
  profileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData): Promise<void> {
    if (!window.confirm(`Permanently delete ${profileName}'s profile and private documents?`))
      return;
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/delete`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const result = (await response.json()) as { error?: string; cleanupPending?: boolean };
    if (!response.ok) {
      setError(result.error ?? "The profile could not be deleted.");
      setBusy(false);
      return;
    }
    window.location.assign(
      `/app/family?profileDeleted=1${result.cleanupPending === true ? "&cleanupPending=1" : ""}`,
    );
  }

  return (
    <form action={submit} className="mt-5 space-y-4">
      {error !== undefined ? (
        <Alert tone="error" title="Could not delete profile">
          {error}
        </Alert>
      ) : null}
      <FormField id="profileConfirmation" label={`Type ${profileName} to confirm`}>
        <Input id="profileConfirmation" name="confirmation" required />
      </FormField>
      <Button type="submit" variant="destructive" disabled={busy}>
        <Trash2 aria-hidden="true" /> {busy ? "Deleting…" : "Delete profile"}
      </Button>
    </form>
  );
}

export function AccountDeletionForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData): Promise<void> {
    if (!window.confirm("Permanently delete this account and its owned profile data?")) return;
    setBusy(true);
    setError(undefined);
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const result = (await response.json()) as { error?: string; cleanupPending?: boolean };
    if (!response.ok) {
      setError(result.error ?? "The account could not be deleted.");
      setBusy(false);
      return;
    }
    window.location.assign(
      `/?accountDeleted=1${result.cleanupPending === true ? "&cleanupPending=1" : ""}`,
    );
  }

  return (
    <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {error !== undefined ? (
        <Alert className="sm:col-span-3" tone="error" title="Could not delete account">
          {error}
        </Alert>
      ) : null}
      <FormField id="accountPassword" label="Current password">
        <Input
          id="accountPassword"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <FormField id="accountConfirmation" label="Type DELETE MY ACCOUNT">
        <Input id="accountConfirmation" name="confirmation" required pattern="DELETE MY ACCOUNT" />
      </FormField>
      <Button type="submit" variant="destructive" disabled={busy}>
        <Trash2 aria-hidden="true" /> {busy ? "Deleting…" : "Delete account"}
      </Button>
    </form>
  );
}
