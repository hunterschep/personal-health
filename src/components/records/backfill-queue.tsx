"use client";

import { ArrowRight, Check, CircleHelp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";

export type BackfillQuestion = {
  serviceId: string;
  service: string;
  eventId: string | null;
  refining: boolean;
  why: string;
  methods: Array<{ id: string; name: string }>;
  existingEvent: {
    methodId: string | null;
    precision: "day" | "month" | "year" | "unknown";
    date: string;
    result: "normal" | "abnormal" | "inconclusive" | "unknown" | "not_applicable";
    providerName: string;
    note: string;
  } | null;
};

export function BackfillQueue({
  profileId,
  questions,
  skippedCount = 0,
}: {
  profileId: string;
  questions: BackfillQuestion[];
  skippedCount?: number;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("completed");
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const current = questions[index];

  async function resetSkipped(): Promise<void> {
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/backfill`, { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "Skipped questions could not be reset.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  if (current === undefined) {
    return (
      <Card className="border-brand/25 bg-brand-soft/65">
        <CardContent className="py-12 text-center">
          <span className="bg-brand mx-auto grid size-14 place-items-center rounded-full text-white">
            <Check aria-hidden="true" />
          </span>
          <h2 className="font-editorial mt-5 text-3xl font-semibold">Backfill complete for now</h2>
          <p className="text-ink-soft mx-auto mt-2 max-w-lg leading-7">
            {saved.length} answer{saved.length === 1 ? "" : "s"} saved. Relevant plan items have
            been recalculated.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <a href={`/app/profile/${profileId}/care-plan`}>Review updated plan</a>
            </Button>
            {skippedCount > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void resetSkipped()}
              >
                <RotateCcw aria-hidden="true" /> Ask {skippedCount} skipped{" "}
                {skippedCount === 1 ? "question" : "questions"} again
              </Button>
            ) : null}
          </div>
          {error !== undefined ? (
            <p className="text-rose mt-3 text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  async function saveAnswer(formData: FormData) {
    if (current === undefined) return;
    setBusy(true);
    setError(undefined);
    const payload = {
      serviceId: current.serviceId,
      eventId: current.eventId,
      answer,
      methodId: String(formData.get("method") ?? "") || null,
      precision: String(formData.get("backfillPrecision") ?? "unknown"),
      date: String(formData.get("backfillDate") ?? "") || null,
      result: String(formData.get("result") ?? "normal"),
      providerName: String(formData.get("providerName") ?? "") || null,
      note: String(formData.get("note") ?? "") || null,
      reason: String(formData.get("reason") ?? "") || null,
    };
    const response = await fetch(`/api/profiles/${profileId}/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "The answer could not be saved.");
      setBusy(false);
      return;
    }
    if (answer !== "skip") setSaved((items) => [...items, current.service]);
    setIndex((value) => value + 1);
    setAnswer("completed");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-ink-soft">
          {Math.round((index / Math.max(questions.length, 1)) * 100)}% complete
        </p>
      </div>
      <div className="bg-surface-muted h-2 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="bg-brand h-full rounded-full transition-all"
          style={{ width: `${(index / Math.max(questions.length, 1)) * 100}%` }}
        />
      </div>
      <Card>
        <CardContent className="space-y-6 sm:p-8">
          <Badge tone="warm">
            <CircleHelp aria-hidden="true" /> History needed
          </Badge>
          <div>
            <h2 className="font-editorial text-3xl font-semibold">
              Have you completed {current.service.toLowerCase()}?
            </h2>
            <p className="text-ink-soft mt-2 leading-7">{current.why}</p>
          </div>
          {error !== undefined ? (
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          <form
            key={`${current.serviceId}:${current.eventId ?? "new"}`}
            action={saveAnswer}
            className="space-y-6"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {(current.refining
                ? ([
                    ["completed", "Yes, refine the date"],
                    ["skip", "Skip for now"],
                  ] as const)
                : ([
                    ["completed", "Yes, I completed it"],
                    ["never", "No, never completed"],
                    ["unsure", "I’m not sure"],
                    ["not_applicable", "This does not apply to me"],
                    ["skip", "Skip for now"],
                  ] as const)
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="border-line has-[:checked]:border-brand has-[:checked]:bg-brand-soft flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3"
                >
                  <input
                    type="radio"
                    name="answer"
                    value={value}
                    checked={answer === value}
                    onChange={() => setAnswer(value)}
                    className="accent-brand size-4"
                  />
                  <span className="text-sm font-semibold">{label}</span>
                </label>
              ))}
            </div>
            {answer === "completed" ? (
              <div className="bg-surface-muted/60 space-y-5 rounded-2xl p-4 sm:p-5">
                <label className="block space-y-2 text-sm font-semibold">
                  Method
                  <Select name="method" defaultValue={current.existingEvent?.methodId ?? ""}>
                    <option value="">Not sure or not applicable</option>
                    {current.methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <ApproximateDateInput
                  name="backfill"
                  initialPrecision={current.existingEvent?.precision ?? "day"}
                  initialValue={current.existingEvent?.date ?? ""}
                />
                <label className="block space-y-2 text-sm font-semibold">
                  Result category
                  <Select name="result" defaultValue={current.existingEvent?.result ?? "normal"}>
                    <option value="normal">Normal or routine</option>
                    <option value="abnormal">Abnormal or positive</option>
                    <option value="inconclusive">Inconclusive</option>
                    <option value="unknown">Not sure</option>
                    <option value="not_applicable">Not applicable</option>
                  </Select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="backfill-provider" label="Provider (optional)">
                    <Input
                      id="backfill-provider"
                      name="providerName"
                      maxLength={120}
                      defaultValue={current.existingEvent?.providerName ?? ""}
                    />
                  </FormField>
                  <FormField id="backfill-note" label="Note (optional)">
                    <Textarea
                      id="backfill-note"
                      name="note"
                      maxLength={2000}
                      rows={3}
                      defaultValue={current.existingEvent?.note ?? ""}
                    />
                  </FormField>
                </div>
              </div>
            ) : null}
            {answer === "not_applicable" ? (
              <div className="border-sky/30 bg-sky-soft/45 rounded-xl border p-4">
                <FormField
                  id="backfill-not-applicable-reason"
                  label="Why does this not apply?"
                  hint="This is stored as your reversible response. It does not change the source-backed medical status unless anatomy, history, or a clinician instruction supports that result."
                >
                  <Textarea
                    id="backfill-not-applicable-reason"
                    name="reason"
                    maxLength={500}
                    required
                  />
                </FormField>
              </div>
            ) : null}
            <div className="border-line flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ink-soft text-xs">
                Previous answers are saved immediately. Never and not-sure answers can be reset from
                the saved-answer list below.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : answer === "skip" ? "Skip" : "Save answer"}{" "}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
