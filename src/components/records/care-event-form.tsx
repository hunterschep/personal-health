"use client";

import { useState } from "react";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";

export type CareEventCatalogService = {
  slug: string;
  name: string;
  category: string;
  methods: { slug: string; name: string }[];
};

export function CareEventForm({
  profileId,
  initialService,
  catalog = [],
}: {
  profileId: string;
  initialService?: string;
  catalog?: CareEventCatalogService[];
}) {
  const [result, setResult] = useState("normal");
  const [service, setService] = useState(initialService ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const selectedService = catalog.find((entry) => entry.slug === service);
  const categories = [...new Set(catalog.map((entry) => entry.category))];

  async function submit(formData: FormData): Promise<void> {
    setSaving(true);
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/care-events`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "The care record could not be saved.");
      setSaving(false);
      return;
    }
    window.location.assign(`/app/profile/${profileId}/records`);
  }

  return (
    <form
      action={submit}
      className="space-y-6"
      onReset={() => {
        setService(initialService ?? "");
        setResult("normal");
        setError(undefined);
      }}
    >
      <input type="hidden" name="profileId" value={profileId} />
      {error !== undefined ? (
        <Alert tone="error" title="Could not save record">
          {error}
        </Alert>
      ) : null}
      <FormField id="service" label="Service">
        <Select
          id="service"
          name="service"
          value={service}
          onChange={(event) => setService(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose a service
          </option>
          {categories.map((category) => (
            <optgroup key={category} label={category.replaceAll("_", " ")}>
              {catalog
                .filter((entry) => entry.category === category)
                .map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </FormField>
      <FormField id="method" label="Method" hint="The method can control the future interval.">
        <Select id="method" name="method">
          <option value="">Not sure or not applicable</option>
          {selectedService?.methods.map((method) => (
            <option key={method.slug} value={method.slug}>
              {method.name}
            </option>
          ))}
        </Select>
      </FormField>
      <ApproximateDateInput />
      <FormField
        id="result"
        label="Result category"
        hint="CareCadence stores the category but never interprets findings."
      >
        <Select
          id="result"
          name="result"
          value={result}
          onChange={(event) => setResult(event.target.value)}
        >
          <option value="normal">Normal or routine</option>
          <option value="abnormal">Abnormal or positive</option>
          <option value="inconclusive">Inconclusive</option>
          <option value="unknown">Not sure</option>
          <option value="not_applicable">Not applicable</option>
        </Select>
      </FormField>
      {result === "abnormal" || result === "inconclusive" ? (
        <Alert tone="warning" title="Routine timing may no longer apply">
          Follow the personal plan from your clinician. You can add that instruction after saving
          this record.
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="provider" label="Provider (optional)">
          <Input id="provider" name="provider" maxLength={120} />
        </FormField>
        <FormField id="location" label="Location (optional)">
          <Input id="location" name="location" maxLength={160} />
        </FormField>
      </div>
      <FormField id="source" label="Where this information came from">
        <Select id="source" name="source" defaultValue="user_memory">
          <option value="user_memory">My memory</option>
          <option value="medical_record">Medical record</option>
          <option value="clinician">Clinician</option>
          <option value="pharmacy">Pharmacy</option>
        </Select>
      </FormField>
      <FormField
        id="notes"
        label="Notes (optional)"
        hint="Do not use this field for urgent concerns."
      >
        <Textarea id="notes" name="notes" maxLength={2000} />
      </FormField>
      <FormField
        id="attachment"
        label="Private document (optional)"
        hint="PDF, JPEG, or PNG. Maximum 10 MB."
      >
        <Input
          id="attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
        />
      </FormField>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="reset" variant="ghost">
          Clear form
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving and recalculating…" : "Save record and recalculate"}
        </Button>
      </div>
    </form>
  );
}
