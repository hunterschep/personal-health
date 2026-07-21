import type {
  VisitPrepData,
  VisitPrepMode,
  VisitPrepSectionKey,
  VisitPrepSectionSelection,
} from "./visit-prep-types";
import { visitPrepSections } from "./visit-prep-types";

const conciseLimits: Record<VisitPrepSectionKey, number> = {
  appointments: 1,
  medications: 4,
  conditions: 4,
  attention: 4,
  thisYear: 3,
  unknown: 3,
  discussion: 3,
  clinician: 3,
  recentEvents: 3,
  personalNotes: 1,
};

export function visibleVisitPrepItems<T>(
  items: readonly T[],
  mode: VisitPrepMode,
  section: VisitPrepSectionKey,
): T[] {
  return mode === "extended" ? [...items] : items.slice(0, conciseLimits[section]);
}

export function omittedVisitPrepItemCount(
  itemCount: number,
  mode: VisitPrepMode,
  section: VisitPrepSectionKey,
): number {
  return mode === "extended" ? 0 : Math.max(0, itemCount - conciseLimits[section]);
}

export function visibleVisitPrepQuestions(
  questions: readonly string[],
  mode: VisitPrepMode,
): string[] {
  void mode;
  // Questions are explicitly selected and ordered by the user, so even the
  // concise agenda must not silently hide them.
  return [...questions];
}

export function omittedVisitPrepQuestionCount(questionCount: number, mode: VisitPrepMode): number {
  void questionCount;
  void mode;
  return 0;
}

export function omittedVisitPrepTotal(
  data: VisitPrepData,
  mode: VisitPrepMode,
  sections: VisitPrepSectionSelection,
  questionCount: number,
): number {
  const sectionTotal = visitPrepSections.reduce(
    (total, { key }) =>
      total + (sections[key] ? omittedVisitPrepItemCount(data[key].length, mode, key) : 0),
    0,
  );
  return sectionTotal + omittedVisitPrepQuestionCount(questionCount, mode);
}

function listSection(title: string, items: readonly string[], empty: string): string[] {
  return ["", title, ...(items.length === 0 ? [`- ${empty}`] : items.map((item) => `- ${item}`))];
}

export function buildVisitPrepSummary(
  data: VisitPrepData,
  mode: VisitPrepMode,
  sections: VisitPrepSectionSelection,
  questions: readonly string[],
): string {
  const lines = [
    `CareCadence visit agenda for ${data.profileName}`,
    `Age ${data.age}`,
    `Generated ${data.generatedOn}`,
    `Format: ${mode === "concise" ? "Concise" : "Extended"}`,
  ];

  if (sections.appointments) {
    const appointments = visibleVisitPrepItems(data.appointments, mode, "appointments").map(
      (appointment) =>
        `${appointment.title} — ${appointment.timing}${appointment.location === null ? "" : ` — ${appointment.location}`} (${appointment.timezone})`,
    );
    lines.push(...listSection("Upcoming appointment", appointments, "None scheduled"));
  }
  if (sections.medications) {
    lines.push(
      ...listSection(
        "Current medications",
        visibleVisitPrepItems(data.medications, mode, "medications"),
        "None recorded",
      ),
    );
  }
  if (sections.conditions) {
    lines.push(
      ...listSection(
        "Major conditions",
        visibleVisitPrepItems(data.conditions, mode, "conditions"),
        "No active conditions recorded",
      ),
    );
  }
  if (sections.attention) {
    lines.push(
      ...listSection(
        "Due now or soon",
        visibleVisitPrepItems(data.attention, mode, "attention"),
        "None in the current plan",
      ),
    );
  }
  if (sections.thisYear) {
    lines.push(
      ...listSection(
        "Due this year",
        visibleVisitPrepItems(data.thisYear, mode, "thisYear"),
        "None in the current plan",
      ),
    );
  }
  if (sections.unknown) {
    lines.push(
      ...listSection(
        "History to clarify",
        visibleVisitPrepItems(data.unknown, mode, "unknown"),
        "None",
      ),
    );
  }
  if (sections.discussion) {
    lines.push(
      ...listSection(
        "Shared decisions",
        visibleVisitPrepItems(data.discussion, mode, "discussion"),
        "None in the current plan",
      ),
    );
  }
  if (sections.clinician) {
    lines.push(
      ...listSection(
        "Personal clinician plan",
        visibleVisitPrepItems(data.clinician, mode, "clinician"),
        "No active instructions",
      ),
    );
  }
  if (sections.recentEvents) {
    lines.push(
      ...listSection(
        "Recent abnormal or inconclusive records",
        visibleVisitPrepItems(data.recentEvents, mode, "recentEvents"),
        "None recorded recently",
      ),
    );
  }
  if (sections.personalNotes) {
    lines.push(
      ...listSection(
        "Personal notes",
        visibleVisitPrepItems(data.personalNotes, mode, "personalNotes"),
        "None added",
      ),
    );
  }

  lines.push(...listSection("Questions", visibleVisitPrepQuestions(questions, mode), "None added"));
  if (data.sourceLinks.length > 0) {
    lines.push(
      ...listSection(
        "Sources",
        data.sourceLinks.map((source) => `${source.label}: ${source.url}`),
        "None listed",
      ),
    );
  }
  const omitted = omittedVisitPrepTotal(data, mode, sections, questions.length);
  if (omitted > 0) {
    lines.push(
      "",
      `Concise format omits ${omitted} additional ${omitted === 1 ? "item" : "items"}. Use Extended for the complete agenda.`,
    );
  }
  lines.push(
    "",
    "Generated by CareCadence. This summary organizes preventive-care information and does not replace clinical advice.",
  );
  return lines.join("\n");
}

export type ClipboardCopyMethod = "clipboard" | "fallback";

export async function copyPlainText(
  text: string,
  options: {
    clipboard?: { writeText(value: string): Promise<void> } | null;
    document?: Document;
  } = {},
): Promise<ClipboardCopyMethod> {
  const clipboard =
    options.clipboard === undefined
      ? typeof navigator === "undefined"
        ? null
        : navigator.clipboard
      : options.clipboard;
  if (clipboard !== null && clipboard !== undefined) {
    try {
      await clipboard.writeText(text);
      return "clipboard";
    } catch {
      // Some browsers expose the API but deny it outside a trusted interaction.
    }
  }

  const copyDocument = options.document ?? (typeof document === "undefined" ? undefined : document);
  if (copyDocument === undefined || copyDocument.body === null) {
    throw new Error("Clipboard access is not available in this browser.");
  }
  const activeElement =
    copyDocument.activeElement instanceof HTMLElement ? copyDocument.activeElement : null;
  const textarea = copyDocument.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  copyDocument.body.append(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    if (typeof copyDocument.execCommand !== "function" || !copyDocument.execCommand("copy")) {
      throw new Error("The browser did not allow this summary to be copied.");
    }
  } finally {
    textarea.remove();
    activeElement?.focus();
  }
  return "fallback";
}
