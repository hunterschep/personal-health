"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form";

export function PasswordChangeForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  async function submit(formData: FormData): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage({ tone: "error", text: result.error ?? "The password could not be changed." });
      setBusy(false);
      return;
    }
    setMessage({
      tone: "success",
      text: "Password changed. Other signed-in devices were disconnected.",
    });
    setBusy(false);
  }

  return (
    <form action={submit} className="mt-5 space-y-4">
      {message !== undefined ? (
        <Alert
          tone={message.tone}
          title={message.tone === "success" ? "Password updated" : "Could not update password"}
        >
          {message.text}
        </Alert>
      ) : null}
      <FormField id="currentPassword" label="Current password">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <FormField
        id="newPassword"
        label="New password"
        hint="Use a passphrase with at least 12 characters."
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password">
        <Input
          id="confirmPassword"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </FormField>
      <Button type="submit" disabled={busy}>
        {busy ? "Updating…" : "Update password and rotate session"}
      </Button>
    </form>
  );
}

export function RevokeOtherSessionsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  async function revoke(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    const response = await fetch("/api/account/sessions/revoke", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const result = (await response.json()) as { error?: string; revoked?: number };
    if (!response.ok) {
      setMessage({ tone: "error", text: result.error ?? "Other sessions could not be revoked." });
    } else {
      const count = result.revoked ?? 0;
      setMessage({
        tone: "success",
        text:
          count === 0
            ? "No other active sessions were found."
            : `${count} other ${count === 1 ? "session was" : "sessions were"} signed out.`,
      });
    }
    setBusy(false);
  }

  return (
    <div>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void revoke()}>
        <ShieldCheck aria-hidden="true" /> {busy ? "Signing out…" : "Sign out all other devices"}
      </Button>
      {message !== undefined ? (
        <p
          className={
            message.tone === "error" ? "text-rose mt-2 text-sm" : "text-brand-strong mt-2 text-sm"
          }
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
