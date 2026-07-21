"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import type { DatePrecision } from "@/contracts";

type RecordEditValue = {
  methodId: string;
  performedDate: string;
  datePrecision: DatePrecision;
  result: "normal" | "abnormal" | "inconclusive" | "unknown" | "not_applicable";
  providerName: string;
  locationName: string;
  notes: string;
  source: "user_memory" | "medical_record" | "clinician" | "pharmacy" | "csv_import";
};

export function RecordActions({
  profileId,
  eventId,
  serviceName,
  methods,
  initialValue,
}: {
  profileId: string;
  eventId: string;
  serviceName: string;
  methods: Array<{ id: string; name: string }>;
  initialValue: RecordEditValue;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save(formData: FormData): Promise<void> {
    setBusy(true);
    setError(undefined);
    const method = String(formData.get("methodId") ?? "");
    const response = await fetch(`/api/profiles/${profileId}/care-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        methodId: method === "" ? null : method,
        performedDate: String(formData.get("performedDate") ?? "") || null,
        datePrecision: String(formData.get("performedPrecision") ?? "unknown"),
        result: String(formData.get("result") ?? "unknown"),
        providerName: String(formData.get("providerName") ?? ""),
        locationName: String(formData.get("locationName") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        source: String(formData.get("source") ?? "user_memory"),
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "The care record could not be updated.");
      setBusy(false);
      return;
    }
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  async function remove(): Promise<void> {
    if (
      !window.confirm(
        "Remove this care record and its attached documents? Documents are permanently removed, and the recommendation plan will be recalculated.",
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/care-events/${eventId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      window.location.assign(`/app/profile/${profileId}/records`);
      return;
    }
    const payload = (await response.json()) as { error?: string };
    setError(payload.error ?? "The record could not be removed.");
    setBusy(false);
  }

  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Pencil aria-hidden="true" /> Edit record
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>
          <Trash2 aria-hidden="true" /> {busy ? "Removing…" : "Remove record"}
        </Button>
      </div>
      {error !== undefined && !open ? (
        <p className="text-rose mt-2 text-right text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit care record</DialogTitle>
            <DialogDescription>
              Correct the known details for {serviceName}. The care plan will recalculate after the
              change.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined ? (
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          <form action={save} className="mt-6 space-y-5">
            <FormField id="record-method" label="Method">
              <Select id="record-method" name="methodId" defaultValue={initialValue.methodId}>
                <option value="">Not sure or not applicable</option>
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <ApproximateDateInput
              name="performed"
              initialPrecision={initialValue.datePrecision}
              initialValue={initialValue.performedDate}
            />
            <FormField id="record-result" label="Result category">
              <Select id="record-result" name="result" defaultValue={initialValue.result}>
                <option value="normal">Normal or routine</option>
                <option value="abnormal">Abnormal or positive</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="unknown">Not sure</option>
                <option value="not_applicable">Not applicable</option>
              </Select>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="record-provider" label="Provider (optional)">
                <Input
                  id="record-provider"
                  name="providerName"
                  defaultValue={initialValue.providerName}
                  maxLength={120}
                />
              </FormField>
              <FormField id="record-location" label="Location (optional)">
                <Input
                  id="record-location"
                  name="locationName"
                  defaultValue={initialValue.locationName}
                  maxLength={160}
                />
              </FormField>
            </div>
            <FormField id="record-source" label="Where this information came from">
              <Select id="record-source" name="source" defaultValue={initialValue.source}>
                <option value="user_memory">My memory</option>
                <option value="medical_record">Medical record</option>
                <option value="clinician">Clinician</option>
                <option value="pharmacy">Pharmacy</option>
                {initialValue.source === "csv_import" ? (
                  <option value="csv_import">CSV import</option>
                ) : null}
              </Select>
            </FormField>
            <FormField id="record-notes" label="Notes (optional)">
              <Textarea
                id="record-notes"
                name="notes"
                defaultValue={initialValue.notes}
                maxLength={2_000}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save and recalculate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
