"use client";

import { ArrowRight, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";

export function ClinicianOverrideForm({
  profileId,
  serviceId,
  initial,
}: {
  profileId: string;
  serviceId: string;
  initial?: {
    id: string;
    type: "exact_next_date" | "recurring_interval" | "no_longer_needed" | "clinician_managed";
    nextDueStart: string;
    nextDueEnd: string;
    intervalValue?: number;
    intervalUnit?: "days" | "weeks" | "months" | "years";
    instructionReceivedDate: string;
    clinicianName: string;
    practiceName: string;
    reason: string;
    reviewDate: string;
    replacesGeneralGuideline: boolean;
  };
}) {
  const [type, setType] = useState<string>(initial?.type ?? "exact_next_date");
  const [replace, setReplace] = useState(initial?.replacesGeneralGuideline ?? true);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData) {
    setSaving(true);
    setError(undefined);
    const overrideInput = {
      ...Object.fromEntries(formData.entries()),
      serviceId,
      type,
      replacesGeneralGuideline: replace,
    };
    const response = await fetch(
      initial === undefined
        ? `/api/profiles/${profileId}/clinician-overrides`
        : `/api/profiles/${profileId}/clinician-overrides/${initial.id}`,
      {
        method: initial === undefined ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial === undefined ? overrideInput : { action: "replace", input: overrideInput },
        ),
      },
    );
    if (response.ok) {
      const result = (await response.json()) as { activeRecommendationId?: string };
      window.location.assign(
        result.activeRecommendationId === undefined
          ? `/app/profile/${profileId}/care-plan`
          : `/app/profile/${profileId}/care-plan/${result.activeRecommendationId}`,
      );
      return;
    }
    const result = (await response.json()) as { error?: string };
    setError(result.error ?? "The clinician instruction could not be saved.");
    setSaving(false);
  }

  return (
    <form action={submit} className="space-y-6">
      <Alert tone="info" title="Personal instruction with general context">
        A replacing instruction controls the active next date. The general guideline remains visible
        underneath for context.
      </Alert>
      {error !== undefined ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}
      <FormField id="overrideType" label="Instruction type">
        <Select
          id="overrideType"
          name="overrideType"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="exact_next_date">Exact next date or range</option>
          <option value="recurring_interval">Recurring personal interval</option>
          <option value="no_longer_needed">Clinician said no longer needed</option>
          <option value="clinician_managed">Clinician manages the timing</option>
        </Select>
      </FormField>
      {type === "exact_next_date" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="dueStart" label="Next due date">
            <Input
              id="dueStart"
              name="nextDueStart"
              type="date"
              defaultValue={initial?.nextDueStart}
              required
            />
          </FormField>
          <FormField id="dueEnd" label="End of due range (optional)">
            <Input id="dueEnd" name="nextDueEnd" type="date" defaultValue={initial?.nextDueEnd} />
          </FormField>
        </div>
      ) : null}
      {type === "recurring_interval" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="intervalValue" label="Repeat every">
            <Input
              id="intervalValue"
              name="intervalValue"
              type="number"
              min={1}
              max={100}
              defaultValue={initial?.intervalValue}
              required
            />
          </FormField>
          <FormField id="intervalUnit" label="Unit">
            <Select id="intervalUnit" name="intervalUnit" defaultValue={initial?.intervalUnit}>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </Select>
          </FormField>
        </div>
      ) : null}
      <FormField id="instructionDate" label="Date the instruction was received">
        <Input
          id="instructionDate"
          name="instructionReceivedDate"
          type="date"
          defaultValue={initial?.instructionReceivedDate}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="clinicianName" label="Clinician (optional)">
          <Input
            id="clinicianName"
            name="clinicianName"
            maxLength={120}
            defaultValue={initial?.clinicianName}
          />
        </FormField>
        <FormField id="practiceName" label="Practice (optional)">
          <Input
            id="practiceName"
            name="practiceName"
            maxLength={160}
            defaultValue={initial?.practiceName}
          />
        </FormField>
      </div>
      <FormField id="reason" label="Instruction or reason (optional)">
        <Textarea id="reason" name="reason" maxLength={1000} defaultValue={initial?.reason} />
      </FormField>
      <FormField id="reviewDate" label="Review this instruction on (optional)">
        <Input id="reviewDate" name="reviewDate" type="date" defaultValue={initial?.reviewDate} />
      </FormField>
      <fieldset>
        <legend className="text-sm font-semibold">Relationship to general guidance</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="border-line has-[:checked]:border-brand has-[:checked]:bg-brand-soft flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3">
            <input
              type="radio"
              checked={replace}
              onChange={() => setReplace(true)}
              className="accent-brand size-4"
            />{" "}
            <span>
              <span className="block text-sm font-semibold">Replace active timing</span>
              <span className="text-ink-soft text-xs">Personal date appears first.</span>
            </span>
          </label>
          <label className="border-line has-[:checked]:border-brand has-[:checked]:bg-brand-soft flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3">
            <input
              type="radio"
              checked={!replace}
              onChange={() => setReplace(false)}
              className="accent-brand size-4"
            />{" "}
            <span>
              <span className="block text-sm font-semibold">Add supplemental action</span>
              <span className="text-ink-soft text-xs">Both actions remain active.</span>
            </span>
          </label>
        </div>
      </fieldset>
      {preview ? (
        <Card className="border-sky/25 bg-sky-soft/60">
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Stethoscope aria-hidden="true" className="text-sky size-5" />
              <Badge tone="cool">Preview</Badge>
            </div>
            <h2 className="font-editorial mt-3 text-2xl font-semibold">
              Follow personal clinician plan
            </h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              This instruction will{" "}
              {replace
                ? "control the primary timing while baseline guidance stays visible"
                : "appear as a separate personal action beside baseline guidance"}
              .
            </p>
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={() => setPreview(true)}>
          Preview change <ArrowRight aria-hidden="true" />
        </Button>
        <Button type="submit" disabled={!preview || saving}>
          {saving
            ? "Saving…"
            : initial === undefined
              ? "Confirm clinician plan"
              : "Save new instruction version"}
        </Button>
      </div>
    </form>
  );
}
