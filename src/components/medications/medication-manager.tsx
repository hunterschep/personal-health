"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  LinkedDocumentManager,
  type LinkedDocumentItem,
} from "@/components/documents/linked-document-manager";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type MedicationFilter = "active" | "paused" | "ended" | "review_due" | "monitoring";

export type MedicationListItem = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  prescriber: string;
  reason: string;
  status: "active" | "paused" | "ended";
  monitoring: string;
  nextReview: string;
  startedDate: string;
  startedPrecision: DatePrecision;
  endedDate: string;
  endedPrecision: DatePrecision;
  notes: string;
  classCodes: string[];
  documents: LinkedDocumentItem[];
};

const medicationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a medication name.").max(160),
    dose: z.string().max(120),
    frequency: z.string().max(120),
    prescriber: z.string().max(160),
    reason: z.string().max(500),
    status: z.enum(["active", "paused", "ended"]),
    startedDate: z.string().max(10),
    startedPrecision: z.enum(["day", "month", "year", "unknown"]),
    endedDate: z.string().max(10),
    endedPrecision: z.enum(["day", "month", "year", "unknown"]),
    monitoring: z.string().max(2_000),
    nextReview: z.union([z.literal(""), z.iso.date("Enter a valid review date.")]),
    notes: z.string().max(2_000),
    classCodes: z
      .string()
      .max(500)
      .refine((value) => {
        const codes = value
          .split(",")
          .map((code) => code.trim().toLowerCase())
          .filter(Boolean);
        return (
          codes.length <= 20 && codes.every((code) => /^[a-z0-9][a-z0-9_:-]{0,79}$/.test(code))
        );
      }, "Use up to 20 comma-separated normalized codes."),
  })
  .superRefine((value, context) => {
    const dateMatchesPrecision = (date: string, precision: DatePrecision): boolean =>
      precision === "unknown" ||
      (precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(date)) ||
      (precision === "month" && /^\d{4}-\d{2}$/.test(date)) ||
      (precision === "year" && /^\d{4}$/.test(date));
    if (!dateMatchesPrecision(value.startedDate, value.startedPrecision)) {
      context.addIssue({
        code: "custom",
        path: ["startedDate"],
        message: "Enter the medication start timing at the selected precision.",
      });
    }
    if (value.status === "ended" && !dateMatchesPrecision(value.endedDate, value.endedPrecision)) {
      context.addIssue({
        code: "custom",
        path: ["endedDate"],
        message: "Enter the medication end timing at the selected precision.",
      });
    }
  });

type MedicationFormValues = z.infer<typeof medicationFormSchema>;

function medicationFormDefaults(medication: MedicationListItem | null): MedicationFormValues {
  return {
    name: medication?.name ?? "",
    dose: medication?.dose ?? "",
    frequency: medication?.frequency ?? "",
    prescriber: medication?.prescriber ?? "",
    reason: medication?.reason ?? "",
    status: medication?.status ?? "active",
    startedDate: medication?.startedDate ?? "",
    startedPrecision: medication?.startedPrecision ?? "unknown",
    endedDate: medication?.endedDate ?? "",
    endedPrecision: medication?.endedPrecision ?? "unknown",
    monitoring: medication?.monitoring ?? "",
    nextReview: medication?.nextReview ?? "",
    notes: medication?.notes ?? "",
    classCodes: medication?.classCodes.join(", ") ?? "",
  };
}

function displayReviewDate(value: string): string {
  if (value === "") return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function displayTiming(value: string, precision: DatePrecision): string {
  if (precision === "unknown" || value === "") return "Date unknown";
  if (precision === "year") return value;
  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T00:00:00.000Z`));
  }
  return displayReviewDate(value);
}

export function MedicationManager({
  profileId,
  initialMedications = [],
  editable = true,
}: {
  profileId: string;
  initialMedications?: MedicationListItem[];
  editable?: boolean;
}) {
  const [medications, setMedications] = useState(initialMedications);
  const [editor, setEditor] = useState<MedicationListItem | null>();
  const [filter, setFilter] = useState<MedicationFilter>("active");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const medicationForm = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: medicationFormDefaults(null),
  });
  const editorStatus = useWatch({ control: medicationForm.control, name: "status" });
  const startedPrecision = useWatch({
    control: medicationForm.control,
    name: "startedPrecision",
  });
  const startedDate = useWatch({ control: medicationForm.control, name: "startedDate" });
  const endedPrecision = useWatch({
    control: medicationForm.control,
    name: "endedPrecision",
  });
  const endedDate = useWatch({ control: medicationForm.control, name: "endedDate" });

  const counts = {
    active: medications.filter(({ status }) => status === "active").length,
    paused: medications.filter(({ status }) => status === "paused").length,
    ended: medications.filter(({ status }) => status === "ended").length,
    review_due: medications.filter(
      ({ status, nextReview }) =>
        status !== "ended" &&
        nextReview !== "" &&
        nextReview <= new Date().toISOString().slice(0, 10),
    ).length,
    monitoring: medications.filter(({ monitoring }) => monitoring !== "").length,
  };
  const filteredMedications = medications.filter((medication) => {
    if (filter === "review_due") {
      return (
        medication.status !== "ended" &&
        medication.nextReview !== "" &&
        medication.nextReview <= new Date().toISOString().slice(0, 10)
      );
    }
    if (filter === "monitoring") return medication.monitoring !== "";
    return medication.status === filter;
  });

  function openEditor(medication: MedicationListItem | null): void {
    medicationForm.reset(medicationFormDefaults(medication));
    setEditor(medication);
  }

  async function saveMedication(values: MedicationFormValues) {
    if (!editable) return;
    setBusy(true);
    setMessage(undefined);
    const next: Omit<MedicationListItem, "id"> = {
      name: values.name.trim(),
      dose: values.dose.trim(),
      frequency: values.frequency.trim(),
      prescriber: values.prescriber.trim(),
      reason: values.reason.trim(),
      status: values.status,
      monitoring: values.monitoring.trim(),
      nextReview: values.nextReview,
      startedDate: values.startedDate,
      startedPrecision: values.startedPrecision,
      endedDate: values.status === "ended" ? values.endedDate : "",
      endedPrecision: values.status === "ended" ? values.endedPrecision : "unknown",
      notes: values.notes.trim(),
      classCodes: [
        ...new Set(
          values.classCodes
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
      documents: editor?.documents ?? [],
    };
    const isEditing = editor !== null && editor !== undefined;
    const response = await fetch(
      isEditing
        ? `/api/profiles/${profileId}/medications/${editor.id}`
        : `/api/profiles/${profileId}/medications`,
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? {
                name: next.name,
                dose: next.dose,
                frequency: next.frequency,
                prescriber: next.prescriber,
                reason: next.reason,
                status: next.status,
                startedDate: next.startedDate,
                startedPrecision: next.startedPrecision,
                endedDate: next.endedDate,
                endedPrecision: next.endedPrecision,
                monitoringInstructions: next.monitoring,
                nextReviewDate: next.nextReview,
                notes: next.notes,
                classCodes: next.classCodes,
              }
            : next,
        ),
      },
    );
    const result = (await response.json()) as MedicationListItem & {
      error?: string;
      medicationId?: string;
    };
    if (!response.ok) {
      setMessage({ tone: "error", text: result.error ?? "The medication could not be saved." });
      setBusy(false);
      return;
    }
    if (isEditing) {
      setMedications((items) =>
        items.map((item) => (item.id === editor.id ? { id: editor.id, ...next } : item)),
      );
    } else {
      setMedications((items) => [result, ...items]);
    }
    setEditor(undefined);
    setMessage({ tone: "success", text: isEditing ? "Medication updated." : "Medication added." });
    setBusy(false);
  }

  async function removeMedication(medication: MedicationListItem) {
    if (!editable) return;
    if (
      !window.confirm(
        `Delete ${medication.name}? Any documents attached to this medication will also be permanently removed.`,
      )
    )
      return;
    setBusy(true);
    setMessage(undefined);
    const response = await fetch(`/api/profiles/${profileId}/medications/${medication.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage({ tone: "error", text: result.error ?? "The medication could not be deleted." });
      setBusy(false);
      return;
    }
    setMedications((items) => items.filter(({ id }) => id !== medication.id));
    setMessage({ tone: "success", text: "Medication deleted." });
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <Alert tone="info" title="No monitoring is inferred from a medication name">
        A task appears only when a clinician instruction, explicit reminder, or reviewed normalized
        medication-class rule supports it.
      </Alert>
      {!editable ? (
        <Alert tone="info" title="View-only access">
          You can read this medication list, but only someone with edit access can change it.
        </Alert>
      ) : null}
      {message !== undefined ? (
        <Alert tone={message.tone} title={message.tone === "success" ? "Saved" : "Could not save"}>
          {message.text}
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Active {counts.active}</Badge>
          <Badge tone="warm">Paused {counts.paused}</Badge>
          <Badge>Ended {counts.ended}</Badge>
        </div>
        {editable ? (
          <Button type="button" onClick={() => openEditor(null)}>
            <Plus aria-hidden="true" /> Add medication
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Medication views">
        {(
          [
            ["active", "Active", counts.active],
            ["paused", "Paused", counts.paused],
            ["ended", "Ended", counts.ended],
            ["review_due", "Review due", counts.review_due],
            ["monitoring", "Monitoring instruction", counts.monitoring],
          ] as const
        ).map(([value, label, count]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "primary" : "secondary"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label} ({count})
          </Button>
        ))}
      </div>

      {medications.length === 0 ? (
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">No medications recorded</h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              The list is optional. Add only what is useful for care coordination, and record
              monitoring only when a clinician supplied it.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {medications.length > 0 && filteredMedications.length === 0 ? (
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">No medications in this view</h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              Choose another medication view or edit a medication to update its status, review date,
              or monitoring instruction.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {filteredMedications.map((medication) => {
        const details = [medication.dose, medication.frequency, medication.prescriber].filter(
          Boolean,
        );
        return (
          <Card key={medication.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-editorial text-2xl font-semibold">{medication.name}</h2>
                  <Badge
                    tone={
                      medication.status === "active"
                        ? "brand"
                        : medication.status === "paused"
                          ? "warm"
                          : "neutral"
                    }
                  >
                    {medication.status}
                  </Badge>
                </div>
                <p className="text-ink-soft mt-2 text-sm">
                  {details.length > 0
                    ? details.join(" · ")
                    : "Dose, frequency, and prescriber not recorded"}
                </p>
                {medication.reason !== "" ? (
                  <p className="text-ink-soft mt-2 text-sm">Reason: {medication.reason}</p>
                ) : null}
                <p className="text-ink-soft mt-2 text-sm">
                  Started: {displayTiming(medication.startedDate, medication.startedPrecision)}
                  {medication.status === "ended"
                    ? ` · Ended: ${displayTiming(medication.endedDate, medication.endedPrecision)}`
                    : ""}
                </p>
                {medication.notes !== "" ? (
                  <p className="text-ink-soft mt-3 text-sm leading-6 whitespace-pre-wrap">
                    Notes: {medication.notes}
                  </p>
                ) : null}
                {medication.classCodes.length > 0 ? (
                  <p className="text-ink-soft mt-2 text-xs">
                    Explicit medication classes: {medication.classCodes.join(", ")}
                  </p>
                ) : null}
                <div className="border-line bg-surface-muted/50 mt-4 rounded-xl border p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck aria-hidden="true" className="text-brand size-4" /> Clinician
                    instruction
                  </p>
                  <p className="text-ink-soft mt-2 text-sm leading-6">
                    {medication.monitoring || "No clinician monitoring instruction recorded."}
                  </p>
                </div>
                <LinkedDocumentManager
                  profileId={profileId}
                  medicationId={medication.id}
                  documents={medication.documents}
                  editable={editable}
                  label="Medication attachment"
                />
              </div>
              <div className="bg-accent-soft rounded-xl p-4 lg:w-52">
                <CalendarClock aria-hidden="true" className="text-accent size-5" />
                <p className="text-ink-soft mt-2 text-xs font-bold tracking-wider uppercase">
                  Next review
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {displayReviewDate(medication.nextReview)}
                </p>
                {editable ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditor(medication)}
                    >
                      <Pencil aria-hidden="true" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void removeMedication(medication)}
                    >
                      <Trash2 aria-hidden="true" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={editor !== undefined} onOpenChange={(open) => !open && setEditor(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor === null ? "Add medication" : `Edit ${editor?.name ?? "medication"}`}
            </DialogTitle>
            <DialogDescription>
              Record the list and only clinician-provided monitoring instructions. CareCadence does
              not infer a schedule from the medication name.
            </DialogDescription>
          </DialogHeader>
          <form
            key={editor?.id ?? "new"}
            onSubmit={medicationForm.handleSubmit(saveMedication)}
            className="mt-6 space-y-4"
            noValidate
          >
            <FormField
              id="med-name"
              label="Medication name"
              {...(medicationForm.formState.errors.name?.message === undefined
                ? {}
                : { error: medicationForm.formState.errors.name.message })}
            >
              <Input id="med-name" {...medicationForm.register("name")} maxLength={160} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="dose" label="Dose (optional)">
                <Input id="dose" {...medicationForm.register("dose")} maxLength={120} />
              </FormField>
              <FormField id="frequency" label="Frequency (optional)">
                <Input id="frequency" {...medicationForm.register("frequency")} maxLength={120} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="prescriber" label="Prescriber (optional)">
                <Input id="prescriber" {...medicationForm.register("prescriber")} maxLength={160} />
              </FormField>
              <FormField id="reason" label="Reason (optional)">
                <Input id="reason" {...medicationForm.register("reason")} maxLength={500} />
              </FormField>
            </div>
            <FormField id="status" label="Status">
              <Select id="status" {...medicationForm.register("status")}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </Select>
            </FormField>
            <ApproximateDateInput
              name="started"
              precision={startedPrecision}
              value={startedDate}
              onPrecisionChange={(precision) => {
                medicationForm.setValue("startedPrecision", precision, { shouldValidate: true });
                if (precision === "unknown") {
                  medicationForm.setValue("startedDate", "", { shouldValidate: true });
                }
              }}
              onValueChange={(value) =>
                medicationForm.setValue("startedDate", value, { shouldValidate: true })
              }
              legend="When did this medication start?"
              unknownDescription="The medication can stay on the list without a guessed start date."
            />
            {medicationForm.formState.errors.startedDate?.message === undefined ? null : (
              <p className="text-rose text-xs font-medium" role="alert">
                {medicationForm.formState.errors.startedDate.message}
              </p>
            )}
            {editorStatus === "ended" ? (
              <>
                <ApproximateDateInput
                  name="ended"
                  precision={endedPrecision}
                  value={endedDate}
                  onPrecisionChange={(precision) => {
                    medicationForm.setValue("endedPrecision", precision, {
                      shouldValidate: true,
                    });
                    if (precision === "unknown") {
                      medicationForm.setValue("endedDate", "", { shouldValidate: true });
                    }
                  }}
                  onValueChange={(value) =>
                    medicationForm.setValue("endedDate", value, { shouldValidate: true })
                  }
                  legend="When did this medication end?"
                  unknownDescription="The medication can be marked ended without a guessed end date."
                />
                {medicationForm.formState.errors.endedDate?.message === undefined ? null : (
                  <p className="text-rose text-xs font-medium" role="alert">
                    {medicationForm.formState.errors.endedDate.message}
                  </p>
                )}
              </>
            ) : null}
            <FormField id="monitoring" label="Clinician monitoring instruction (optional)">
              <Textarea
                id="monitoring"
                {...medicationForm.register("monitoring")}
                maxLength={2_000}
              />
            </FormField>
            <FormField
              id="nextReview"
              label="Next review date (optional)"
              {...(medicationForm.formState.errors.nextReview?.message === undefined
                ? {}
                : { error: medicationForm.formState.errors.nextReview.message })}
            >
              <Input id="nextReview" {...medicationForm.register("nextReview")} type="date" />
            </FormField>
            <FormField id="medication-notes" label="Notes (optional)">
              <Textarea
                id="medication-notes"
                {...medicationForm.register("notes")}
                maxLength={2_000}
              />
            </FormField>
            <FormField
              id="medication-class-codes"
              label="Normalized medication class codes (optional)"
              hint="Comma-separated codes supplied explicitly by a clinician or reviewed record. CareCadence never derives these from the medication name."
              {...(medicationForm.formState.errors.classCodes?.message === undefined
                ? {}
                : { error: medicationForm.formState.errors.classCodes.message })}
            >
              <Input
                id="medication-class-codes"
                {...medicationForm.register("classCodes")}
                maxLength={500}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditor(undefined)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save medication"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
