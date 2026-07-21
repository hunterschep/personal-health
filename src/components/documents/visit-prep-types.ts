export type VisitPrepMode = "concise" | "extended";

export type VisitPrepAppointment = {
  title: string;
  timing: string;
  timezone: string;
  location: string | null;
};

export type VisitPrepSourceLink = {
  label: string;
  url: string;
};

export type VisitPrepData = {
  profileName: string;
  age: number;
  generatedOn: string;
  appointments: VisitPrepAppointment[];
  medications: string[];
  conditions: string[];
  attention: string[];
  thisYear: string[];
  unknown: string[];
  discussion: string[];
  clinician: string[];
  recentEvents: string[];
  personalNotes: string[];
  sourceLinks: VisitPrepSourceLink[];
  suggestedQuestions: string[];
};

export type VisitPrepSectionKey =
  | "appointments"
  | "medications"
  | "conditions"
  | "attention"
  | "thisYear"
  | "unknown"
  | "discussion"
  | "clinician"
  | "recentEvents"
  | "personalNotes";

export type VisitPrepSectionSelection = Record<VisitPrepSectionKey, boolean>;

export const visitPrepSections: ReadonlyArray<{
  key: VisitPrepSectionKey;
  controlLabel: string;
}> = [
  { key: "appointments", controlLabel: "Upcoming appointment" },
  { key: "medications", controlLabel: "Current medications" },
  { key: "conditions", controlLabel: "Major conditions" },
  { key: "attention", controlLabel: "Due now or soon" },
  { key: "thisYear", controlLabel: "Due this year" },
  { key: "unknown", controlLabel: "History to clarify" },
  { key: "discussion", controlLabel: "Shared decisions" },
  { key: "clinician", controlLabel: "Personal clinician plan" },
  { key: "recentEvents", controlLabel: "Recent flagged results" },
  { key: "personalNotes", controlLabel: "Personal notes" },
];

export type VisitPrepDraft = {
  mode: VisitPrepMode;
  sections: VisitPrepSectionSelection;
  questions: string[];
  personalNotes: string;
};
