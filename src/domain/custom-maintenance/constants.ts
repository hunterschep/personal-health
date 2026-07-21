export const CUSTOM_LAB_WARNING =
  "This is a personal or clinician-defined lab plan, not a universal annual screening requirement.";

export const CUSTOM_MAINTENANCE_CATEGORIES = [
  "Primary care",
  "Dental",
  "Vision",
  "Hearing",
  "Skin care",
  "Medication support",
  "Specialist follow-up",
  "Planning",
  "Labs",
  "Other",
] as const;

export const CUSTOM_MAINTENANCE_SOURCE_LABELS = {
  personal: "Personal reminder",
  clinician: "Clinician instruction",
  app_template: "Health-maintenance cadence",
} as const;
