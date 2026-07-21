"use client";

import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { CustomMaintenanceView } from "@/server/custom-maintenance";
import {
  CUSTOM_LAB_WARNING,
  CUSTOM_MAINTENANCE_CATEGORIES,
} from "@/domain/custom-maintenance/constants";
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
import { Switch } from "@/components/ui/switch";

export type MaintenanceTemplateView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  purpose: string;
  kind: "routine" | "lab_bundle";
  warning: string | null;
  adoption: { id: string; status: "active" | "ask_clinician" | "disabled" } | null;
};

type LabEntryDraft = { key: string; name: string; note: string };

type ScheduleDraft = {
  cadenceValue: string;
  cadenceUnit: "days" | "weeks" | "months" | "years";
  startDate: string;
  stopDate: string;
  nextDate: string;
  reminderEnabled: boolean;
  reminderDaysBefore: string;
  visibility: "profile_access" | "owner_only";
  notes: string;
  labEntries: LabEntryDraft[];
};

function emptySchedule(kind: "routine" | "lab_bundle"): ScheduleDraft {
  return {
    cadenceValue: "",
    cadenceUnit: "months",
    startDate: "",
    stopDate: "",
    nextDate: "",
    reminderEnabled: false,
    reminderDaysBefore: "14",
    visibility: "profile_access",
    notes: "",
    labEntries: kind === "lab_bundle" ? [{ key: "new-lab-1", name: "", note: "" }] : [],
  };
}

function scheduleFromItem(item: CustomMaintenanceView): ScheduleDraft {
  return {
    cadenceValue: item.cadenceValue?.toString() ?? "",
    cadenceUnit: item.cadenceUnit ?? "months",
    startDate: item.startDate ?? "",
    stopDate: item.stopDate ?? "",
    nextDate: item.nextDate ?? "",
    reminderEnabled: item.reminderEnabled,
    reminderDaysBefore: item.reminderDaysBefore?.toString() ?? "14",
    visibility: item.visibility,
    notes: item.notes ?? "",
    labEntries: item.labEntries.map((entry) => ({
      key: entry.id,
      name: entry.name,
      note: entry.note ?? "",
    })),
  };
}

function schedulePayload(draft: ScheduleDraft) {
  return {
    cadenceValue: draft.cadenceValue,
    cadenceUnit: draft.cadenceValue === "" ? "" : draft.cadenceUnit,
    startDate: draft.startDate,
    stopDate: draft.stopDate,
    nextDate: draft.nextDate,
    reminderEnabled: draft.reminderEnabled,
    reminderDaysBefore: draft.reminderEnabled ? draft.reminderDaysBefore : "",
    visibility: draft.visibility,
    notes: draft.notes,
    labEntries: draft.labEntries.map(({ name, note }) => ({ name, note })),
  };
}

function LabEntryFields({
  entries,
  onChange,
}: {
  entries: LabEntryDraft[];
  onChange: (entries: LabEntryDraft[]) => void;
}) {
  return (
    <fieldset className="border-line rounded-2xl border p-4 sm:p-5">
      <legend className="font-editorial px-2 text-xl font-semibold">Individual lab entries</legend>
      <p className="text-ink-soft mb-4 text-sm leading-6">
        List only the tests that belong to this personal plan. CareCadence will not add tests or
        infer a bundle.
      </p>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={entry.key}
            className="bg-surface-muted/55 grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <FormField id={`lab-name-${entry.key}`} label={`Lab ${index + 1}`}>
              <Input
                id={`lab-name-${entry.key}`}
                value={entry.name}
                maxLength={160}
                required
                placeholder="e.g. Lipid panel"
                onChange={(event) =>
                  onChange(
                    entries.map((candidate) =>
                      candidate.key === entry.key
                        ? { ...candidate, name: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
            </FormField>
            <FormField id={`lab-note-${entry.key}`} label="Short note (optional)">
              <Input
                id={`lab-note-${entry.key}`}
                value={entry.note}
                maxLength={500}
                placeholder="Clinician context"
                onChange={(event) =>
                  onChange(
                    entries.map((candidate) =>
                      candidate.key === entry.key
                        ? { ...candidate, note: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              aria-label={`Remove lab ${index + 1}`}
              disabled={entries.length === 1}
              onClick={() => onChange(entries.filter((candidate) => candidate.key !== entry.key))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="quiet"
        size="sm"
        className="mt-3"
        disabled={entries.length >= 30}
        onClick={() =>
          onChange([...entries, { key: globalThis.crypto.randomUUID(), name: "", note: "" }])
        }
      >
        <Plus aria-hidden="true" /> Add another lab
      </Button>
    </fieldset>
  );
}

function ScheduleFields({
  draft,
  setDraft,
  kind,
  canUseOwnerOnly,
}: {
  draft: ScheduleDraft;
  setDraft: (draft: ScheduleDraft) => void;
  kind: "routine" | "lab_bundle";
  canUseOwnerOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      <fieldset className="border-line rounded-2xl border p-4 sm:p-5">
        <legend className="font-editorial px-2 text-xl font-semibold">Timing</legend>
        <p className="text-ink-soft mb-4 text-sm leading-6">
          A cadence is optional for a custom item. Without one, the item stays neutral and is never
          marked overdue.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cadence-value" label="Repeat every (optional)">
            <Input
              id="cadence-value"
              type="number"
              min={1}
              max={{ days: 3650, weeks: 520, months: 120, years: 100 }[draft.cadenceUnit]}
              inputMode="numeric"
              value={draft.cadenceValue}
              placeholder="e.g. 6"
              onChange={(event) => setDraft({ ...draft, cadenceValue: event.target.value })}
            />
          </FormField>
          <FormField id="cadence-unit" label="Cadence unit">
            <Select
              id="cadence-unit"
              value={draft.cadenceUnit}
              disabled={draft.cadenceValue === ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  cadenceUnit: event.target.value as ScheduleDraft["cadenceUnit"],
                })
              }
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </Select>
          </FormField>
          <FormField id="maintenance-start" label="Start date (optional)">
            <Input
              id="maintenance-start"
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
            />
          </FormField>
          <FormField id="maintenance-stop" label="Stop date (optional)">
            <Input
              id="maintenance-stop"
              type="date"
              value={draft.stopDate}
              min={draft.startDate || undefined}
              onChange={(event) => setDraft({ ...draft, stopDate: event.target.value })}
            />
          </FormField>
          <FormField
            id="maintenance-next"
            label="Next date (optional)"
            hint="This is personal planning timing, not a guideline deadline."
          >
            <Input
              id="maintenance-next"
              type="date"
              value={draft.nextDate}
              min={draft.startDate || undefined}
              max={draft.stopDate || undefined}
              onChange={(event) => setDraft({ ...draft, nextDate: event.target.value })}
            />
          </FormField>
        </div>
      </fieldset>

      {kind === "lab_bundle" ? (
        <LabEntryFields
          entries={draft.labEntries}
          onChange={(labEntries) => setDraft({ ...draft, labEntries })}
        />
      ) : null}

      <fieldset className="border-line rounded-2xl border p-4 sm:p-5">
        <legend className="font-editorial px-2 text-xl font-semibold">Reminder and privacy</legend>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">In-app reminder</p>
            <p id="custom-reminder-hint" className="text-ink-soft mt-1 text-xs leading-5">
              A next date is required. This preference does not create a federal recommendation.
            </p>
          </div>
          <Switch
            checked={draft.reminderEnabled}
            aria-label="Enable an in-app reminder"
            aria-describedby="custom-reminder-hint"
            onCheckedChange={(checked) => setDraft({ ...draft, reminderEnabled: checked })}
          />
        </div>
        {draft.reminderEnabled ? (
          <FormField id="reminder-days" label="Remind me this many days before">
            <Input
              id="reminder-days"
              className="mt-4 max-w-40"
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              required
              value={draft.reminderDaysBefore}
              onChange={(event) => setDraft({ ...draft, reminderDaysBefore: event.target.value })}
            />
          </FormField>
        ) : null}
        <div className="mt-5">
          <FormField id="maintenance-visibility" label="Visibility">
            <Select
              id="maintenance-visibility"
              value={draft.visibility}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  visibility: event.target.value as ScheduleDraft["visibility"],
                })
              }
            >
              <option value="profile_access">People with profile access</option>
              {canUseOwnerOnly ? <option value="owner_only">Only the profile owner</option> : null}
            </Select>
          </FormField>
        </div>
      </fieldset>

      <FormField id="maintenance-notes" label="Notes (optional)">
        <Textarea
          id="maintenance-notes"
          value={draft.notes}
          maxLength={2000}
          placeholder="Keep notes concise and practical."
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </FormField>
    </div>
  );
}

function requestErrorMessage(value: unknown): string {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return "The plan could not be saved. Check the information and try again.";
  }
  return typeof value.error === "string"
    ? value.error
    : "The plan could not be saved. Check the information and try again.";
}

export function MaintenanceEditor({
  profileId,
  kind,
  item,
  open,
  canUseOwnerOnly,
  onOpenChange,
  onSaved,
}: {
  profileId: string;
  kind: "routine" | "lab_bundle";
  item: CustomMaintenanceView | null;
  open: boolean;
  canUseOwnerOnly: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: CustomMaintenanceView) => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState(item?.category ?? (kind === "lab_bundle" ? "Labs" : ""));
  const [purpose, setPurpose] = useState(item?.purpose ?? "");
  const [source, setSource] = useState<"personal" | "clinician">(
    item?.source === "clinician" ? "clinician" : "personal",
  );
  const [clinicianName, setClinicianName] = useState(item?.clinicianName ?? "");
  const [practiceName, setPracticeName] = useState(item?.practiceName ?? "");
  const [schedule, setSchedule] = useState(
    item === null ? emptySchedule(kind) : scheduleFromItem(item),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        item === null
          ? `/api/profiles/${profileId}/custom-maintenance`
          : `/api/profiles/${profileId}/custom-maintenance/${item.id}`,
        {
          method: item === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            category,
            purpose,
            kind,
            source,
            clinicianName,
            practiceName,
            ...schedulePayload(schedule),
          }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(requestErrorMessage(result));
        return;
      }
      onSaved(result as CustomMaintenanceView);
      onOpenChange(false);
    } catch {
      setError("The plan could not be saved. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {item === null
              ? `Add ${kind === "lab_bundle" ? "a lab bundle" : "custom maintenance"}`
              : "Edit custom plan"}
          </DialogTitle>
          <DialogDescription>
            Record timing you chose or received from a clinician. This item stays separate from
            source-backed recommendations.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {kind === "lab_bundle" ? (
            <Alert tone="warning" title="Personal lab plan">
              {CUSTOM_LAB_WARNING}
            </Alert>
          ) : null}
          {error !== null ? (
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="maintenance-title"
              label={kind === "lab_bundle" ? "Bundle name" : "Service title"}
            >
              <Input
                id="maintenance-title"
                value={title}
                maxLength={160}
                required
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
            <FormField id="maintenance-category" label="Category">
              <Input
                id="maintenance-category"
                list="maintenance-categories"
                value={category}
                maxLength={100}
                required
                onChange={(event) => setCategory(event.target.value)}
              />
              <datalist id="maintenance-categories">
                {CUSTOM_MAINTENANCE_CATEGORIES.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </FormField>
          </div>
          <FormField id="maintenance-purpose" label="Purpose (optional)">
            <Textarea
              id="maintenance-purpose"
              value={purpose}
              maxLength={1000}
              placeholder="Why this belongs in the personal plan"
              onChange={(event) => setPurpose(event.target.value)}
            />
          </FormField>
          <fieldset className="border-line rounded-2xl border p-4 sm:p-5">
            <legend className="font-editorial px-2 text-xl font-semibold">Plan source</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="maintenance-source" label="Label">
                <Select
                  id="maintenance-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value as typeof source)}
                >
                  <option value="personal">Personal reminder</option>
                  <option value="clinician">Clinician instruction</option>
                </Select>
              </FormField>
              {source === "clinician" ? (
                <>
                  <FormField id="clinician-name" label="Clinician (optional)">
                    <Input
                      id="clinician-name"
                      value={clinicianName}
                      maxLength={160}
                      onChange={(event) => setClinicianName(event.target.value)}
                    />
                  </FormField>
                  <FormField id="practice-name" label="Practice (optional)">
                    <Input
                      id="practice-name"
                      value={practiceName}
                      maxLength={160}
                      onChange={(event) => setPracticeName(event.target.value)}
                    />
                  </FormField>
                </>
              ) : null}
            </div>
          </fieldset>

          <ScheduleFields
            draft={schedule}
            setDraft={setSchedule}
            kind={kind}
            canUseOwnerOnly={canUseOwnerOnly}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {kind === "lab_bundle" ? <FlaskConical aria-hidden="true" /> : null}
              {submitting ? "Saving…" : item === null ? "Add to plan" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateAdoptionDialog({
  profileId,
  template,
  item,
  open,
  canUseOwnerOnly,
  onOpenChange,
  onSaved,
}: {
  profileId: string;
  template: MaintenanceTemplateView;
  item: CustomMaintenanceView | null;
  open: boolean;
  canUseOwnerOnly: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: CustomMaintenanceView) => void;
}) {
  const initialChoice =
    item?.status === "disabled"
      ? "disabled"
      : item?.status === "ask_clinician"
        ? "ask_clinician"
        : "cadence";
  const [choice, setChoice] = useState<"cadence" | "ask_clinician" | "disabled">(initialChoice);
  const [source, setSource] = useState<"app_template" | "clinician">(
    item?.source === "clinician" ? "clinician" : "app_template",
  );
  const [clinicianName, setClinicianName] = useState(item?.clinicianName ?? "");
  const [practiceName, setPracticeName] = useState(item?.practiceName ?? "");
  const [schedule, setSchedule] = useState(
    item === null ? emptySchedule(template.kind) : scheduleFromItem(item),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/profiles/${profileId}/custom-maintenance/templates/${encodeURIComponent(template.slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice,
            source,
            clinicianName,
            practiceName,
            ...(choice === "cadence"
              ? schedulePayload(schedule)
              : {
                  ...schedulePayload({
                    ...emptySchedule(template.kind),
                    visibility: schedule.visibility,
                    notes: schedule.notes,
                  }),
                  labEntries: [],
                }),
          }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(requestErrorMessage(result));
        return;
      }
      onSaved(result as CustomMaintenanceView);
      onOpenChange(false);
    } catch {
      setError("The template choice could not be saved. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.purpose}</DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {template.kind === "lab_bundle" ? (
            <Alert tone="warning" title="Personal lab plan">
              {CUSTOM_LAB_WARNING}
            </Alert>
          ) : null}
          {error !== null ? (
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          <fieldset>
            <legend className="text-sm font-semibold">What would you like to do?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["cadence", "Choose cadence", "Add timing you chose or received."],
                ["ask_clinician", "Ask my clinician", "Keep this as a neutral discussion prompt."],
                ["disabled", "Disable", "Hide the template from the active plan."],
              ].map(([value, label, description]) => (
                <label
                  key={value}
                  className={`rounded-2xl border p-4 transition ${
                    choice === value
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface-raised"
                  }`}
                >
                  <input
                    type="radio"
                    name="template-choice"
                    value={value}
                    checked={choice === value}
                    className="accent-brand"
                    onChange={() => setChoice(value as typeof choice)}
                  />
                  <span className="ml-2 text-sm font-semibold">{label}</span>
                  <span className="text-ink-soft mt-2 block text-xs leading-5">{description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {choice === "cadence" ? (
            <>
              <fieldset className="border-line rounded-2xl border p-4 sm:p-5">
                <legend className="font-editorial px-2 text-xl font-semibold">
                  Cadence source
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="template-source" label="Label">
                    <Select
                      id="template-source"
                      value={source}
                      onChange={(event) => setSource(event.target.value as typeof source)}
                    >
                      <option value="app_template">Health-maintenance cadence</option>
                      <option value="clinician">Clinician instruction</option>
                    </Select>
                  </FormField>
                  {source === "clinician" ? (
                    <>
                      <FormField id="template-clinician" label="Clinician (optional)">
                        <Input
                          id="template-clinician"
                          value={clinicianName}
                          maxLength={160}
                          onChange={(event) => setClinicianName(event.target.value)}
                        />
                      </FormField>
                      <FormField id="template-practice" label="Practice (optional)">
                        <Input
                          id="template-practice"
                          value={practiceName}
                          maxLength={160}
                          onChange={(event) => setPracticeName(event.target.value)}
                        />
                      </FormField>
                    </>
                  ) : null}
                </div>
              </fieldset>
              <ScheduleFields
                draft={schedule}
                setDraft={setSchedule}
                kind={template.kind}
                canUseOwnerOnly={canUseOwnerOnly}
              />
            </>
          ) : (
            <>
              <Alert
                tone="info"
                title={choice === "ask_clinician" ? "No cadence selected" : "Template disabled"}
              >
                {choice === "ask_clinician"
                  ? "This stays a conversation prompt. It has no next date and cannot become overdue."
                  : "You can return later and choose a cadence or ask a clinician."}
              </Alert>
              <FormField id="template-visibility" label="Visibility">
                <Select
                  id="template-visibility"
                  value={schedule.visibility}
                  onChange={(event) =>
                    setSchedule({
                      ...schedule,
                      visibility: event.target.value as ScheduleDraft["visibility"],
                    })
                  }
                >
                  <option value="profile_access">People with profile access</option>
                  {canUseOwnerOnly ? (
                    <option value="owner_only">Only the profile owner</option>
                  ) : null}
                </Select>
              </FormField>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save choice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
