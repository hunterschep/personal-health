"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  Clipboard,
  Download,
  Plus,
  Printer,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Textarea } from "@/components/ui/form";

import { VisitPrepSheet } from "./visit-prep-sheet";
import { buildVisitPrepSummary, copyPlainText } from "./visit-prep-utils";
import {
  visitPrepSections,
  type VisitPrepData,
  type VisitPrepDraft,
  type VisitPrepMode,
  type VisitPrepSectionSelection,
} from "./visit-prep-types";

type Question = { id: string; text: string };
type CopyState = "idle" | "copying" | "clipboard" | "fallback" | "error";

function initialSectionSelection(): VisitPrepSectionSelection {
  return {
    appointments: true,
    medications: true,
    conditions: true,
    attention: true,
    thisYear: true,
    unknown: true,
    discussion: true,
    clinician: true,
    recentEvents: true,
    personalNotes: true,
  };
}

export function VisitPrep({
  profileId,
  data,
  exportable,
  initialDraft = null,
  savable = true,
}: {
  profileId: string;
  data: VisitPrepData;
  exportable: boolean;
  initialDraft?: VisitPrepDraft | null;
  savable?: boolean;
}) {
  const initialQuestions = initialDraft?.questions ?? data.suggestedQuestions;
  const questionIdPrefix = useId().replaceAll(":", "");
  const nextQuestionNumber = useRef(initialQuestions.length);
  const [mode, setMode] = useState<VisitPrepMode>(initialDraft?.mode ?? "concise");
  const [sections, setSections] = useState<VisitPrepSectionSelection>(
    initialDraft?.sections ?? initialSectionSelection,
  );
  const [questions, setQuestions] = useState<Question[]>(() =>
    initialQuestions.map((text, index) => ({
      id: `${questionIdPrefix}-suggested-${index}`,
      text,
    })),
  );
  const [personalNotes, setPersonalNotes] = useState(initialDraft?.personalNotes ?? "");
  const [question, setQuestion] = useState("");
  const [questionMessage, setQuestionMessage] = useState<string>();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState<{
    tone: "success" | "error";
    text: string;
  }>();

  const questionText = useMemo(() => questions.map((item) => item.text), [questions]);
  const agendaData = useMemo(
    () => ({ ...data, personalNotes: personalNotes.trim() === "" ? [] : [personalNotes.trim()] }),
    [data, personalNotes],
  );
  const summary = useMemo(
    () => buildVisitPrepSummary(agendaData, mode, sections, questionText),
    [agendaData, mode, questionText, sections],
  );

  function addQuestion(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = question.trim();
    if (text === "") return;
    const id = `${questionIdPrefix}-custom-${nextQuestionNumber.current}`;
    nextQuestionNumber.current += 1;
    setQuestions((items) => [...items, { id, text }]);
    setQuestion("");
    setQuestionMessage("Question added at the end of the list.");
  }

  function removeQuestion(id: string): void {
    setQuestions((items) => items.filter((item) => item.id !== id));
    setQuestionMessage("Question removed.");
  }

  function moveQuestion(id: string, direction: -1 | 1): void {
    setQuestions((items) => {
      const index = items.findIndex((item) => item.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= items.length) return items;
      const next = [...items];
      const [moved] = next.splice(index, 1);
      if (moved === undefined) return items;
      next.splice(destination, 0, moved);
      return next;
    });
    setQuestionMessage(direction === -1 ? "Question moved up." : "Question moved down.");
  }

  async function copySummary(): Promise<void> {
    setCopyState("copying");
    try {
      const method = await copyPlainText(summary);
      setCopyState(method);
    } catch {
      setCopyState("error");
    }
  }

  async function saveDraft(): Promise<void> {
    if (!savable) return;
    setSavingDraft(true);
    setDraftMessage(undefined);
    try {
      const response = await fetch(`/api/profiles/${profileId}/visit-prep-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mode, sections, questions: questionText, personalNotes }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Visit-prep preferences could not be saved.");
      }
      setDraftMessage({ tone: "success", text: "Visit-prep preferences and notes saved." });
    } catch (reason) {
      setDraftMessage({
        tone: "error",
        text:
          reason instanceof Error ? reason.message : "Visit-prep preferences could not be saved.",
      });
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="no-print space-y-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-editorial text-xl font-semibold">Agenda format</h2>
              <Badge tone={mode === "concise" ? "brand" : "warm"}>
                {mode === "concise" ? "One-page target" : "All details"}
              </Badge>
            </div>
            <fieldset className="mt-4 grid gap-2">
              <legend className="sr-only">Print detail level</legend>
              {(
                [
                  ["concise", "Concise", "Prioritizes one readable page."],
                  ["extended", "Extended", "Includes every available item."],
                ] as const
              ).map(([value, label, description]) => (
                <label
                  key={value}
                  className="border-line has-[:checked]:border-brand has-[:checked]:bg-brand-soft flex cursor-pointer gap-3 rounded-xl border p-3"
                >
                  <input
                    type="radio"
                    name="visitPrepMode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="accent-brand mt-1 size-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="text-ink-soft mt-0.5 block text-xs leading-5">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-editorial text-xl font-semibold">Personal notes</h2>
            <p className="text-ink-soft mt-1 text-xs leading-5">
              Add concise private context you want on this agenda. Do not use this for urgent
              concerns.
            </p>
            <div className="mt-4">
              <FormField id="visit-personal-notes" label="Notes">
                <Textarea
                  id="visit-personal-notes"
                  value={personalNotes}
                  maxLength={4_000}
                  onChange={(event) => setPersonalNotes(event.target.value)}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {savable ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={savingDraft}
            onClick={() => void saveDraft()}
          >
            <Save aria-hidden="true" /> {savingDraft ? "Saving…" : "Save draft preferences"}
          </Button>
        ) : null}

        {draftMessage === undefined ? null : (
          <Alert
            tone={draftMessage.tone}
            title={draftMessage.tone === "success" ? "Draft saved" : "Could not save draft"}
          >
            {draftMessage.text}
          </Alert>
        )}

        <Card>
          <CardContent>
            <h2 className="font-editorial text-xl font-semibold">Include sections</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {visitPrepSections.map(({ key, controlLabel }) => (
                <label
                  key={key}
                  className="border-line flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={(event) =>
                      setSections((current) => ({ ...current, [key]: event.target.checked }))
                    }
                    className="accent-brand size-4"
                  />
                  {controlLabel}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-editorial text-xl font-semibold">Questions</h2>
            <p className="text-ink-soft mt-1 text-xs leading-5">
              Add, remove, or reorder questions in the sequence you want to discuss them.
            </p>
            <form className="mt-4 flex gap-2" onSubmit={addQuestion}>
              <Input
                value={question}
                maxLength={240}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Add a question"
                aria-label="New visit question"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Add question"
                disabled={question.trim() === ""}
              >
                <Plus aria-hidden="true" />
              </Button>
            </form>
            {questions.length === 0 ? (
              <p className="text-ink-soft mt-4 text-sm">No questions added yet.</p>
            ) : (
              <ol className="mt-3 space-y-2" aria-label="Questions for the visit">
                {questions.map((item, index) => (
                  <li
                    key={item.id}
                    className="border-line bg-surface-muted flex items-start gap-2 rounded-xl border p-2 text-xs"
                  >
                    <span className="bg-surface-raised grid size-6 shrink-0 place-items-center rounded-full font-bold">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 pt-1 leading-5">{item.text}</span>
                    <span className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 min-h-8"
                        aria-label={`Move ${item.text} up`}
                        disabled={index === 0}
                        onClick={() => moveQuestion(item.id, -1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 min-h-8"
                        aria-label={`Move ${item.text} down`}
                        disabled={index === questions.length - 1}
                        onClick={() => moveQuestion(item.id, 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 min-h-8"
                        aria-label={`Remove ${item.text}`}
                        onClick={() => removeQuestion(item.id)}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="sr-only" aria-live="polite">
              {questionMessage}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden="true" /> Print
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={copyState === "copying"}
            onClick={() => void copySummary()}
          >
            {copyState === "clipboard" || copyState === "fallback" ? (
              <Check aria-hidden="true" />
            ) : (
              <Clipboard aria-hidden="true" />
            )}{" "}
            {copyState === "copying"
              ? "Copying…"
              : copyState === "clipboard" || copyState === "fallback"
                ? "Copied"
                : "Copy"}
          </Button>
          {exportable ? (
            <>
              <Button variant="secondary" asChild>
                <Link prefetch={false} href={`/api/profiles/${profileId}/calendar.ics`}>
                  <CalendarPlus aria-hidden="true" /> Calendar
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link prefetch={false} href={`/api/profiles/${profileId}/export`}>
                  <Download aria-hidden="true" /> Export
                </Link>
              </Button>
            </>
          ) : null}
        </div>

        {copyState === "clipboard" ? (
          <Alert tone="success" title="Summary copied">
            Plain text is ready to paste into a secure message or note.
          </Alert>
        ) : copyState === "fallback" ? (
          <Alert tone="success" title="Summary copied">
            The browser compatibility copy method worked. Review the destination before sending.
          </Alert>
        ) : copyState === "error" ? (
          <Alert tone="error" title="Copy did not work">
            Your browser blocked both clipboard methods. Select the agenda text manually or print it
            instead.
          </Alert>
        ) : null}

        <Button variant="ghost" className="w-full" asChild>
          <Link href={`/app/profile/${profileId}/calendar`}>Manage appointment information</Link>
        </Button>
      </aside>

      <VisitPrepSheet data={agendaData} mode={mode} sections={sections} questions={questionText} />

      <div className="no-print xl:col-span-2">
        <Alert tone="warning" title="Keep the printout private">
          This agenda contains sensitive health information for one profile only. Review the mode,
          included sections, and appointment details before printing or copying.
        </Alert>
      </div>
    </div>
  );
}

export type { VisitPrepData } from "./visit-prep-types";
