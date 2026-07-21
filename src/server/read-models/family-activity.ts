type ActivityProfile = {
  displayName: string;
  visibility: "owner_only" | "selected_members" | "household";
};

const REDACTED_ACTIVITY_LABELS: Record<string, string> = {
  "care_event.created": "A care record was added to a visible profile.",
  "care_event.updated": "A care record changed on a visible profile.",
  "care_plan.changed": "A shared care plan changed.",
  "guideline_rule.updated": "Reviewed guidance changed a shared care plan.",
  "profile.created": "A new visible adult profile was created.",
  "profile.sharing_updated": "Sharing changed for a visible profile.",
  "household.invite_accepted": "A household invitation was accepted.",
};

export function familyActivityLabel(input: {
  action: string;
  profile: ActivityProfile | null;
  detailEnabled: boolean;
}): string {
  const redacted = REDACTED_ACTIVITY_LABELS[input.action] ?? "A visible household item changed.";
  if (!input.detailEnabled || input.profile === null || input.profile.visibility === "owner_only") {
    return redacted;
  }

  const possessive = input.profile.displayName.endsWith("s")
    ? `${input.profile.displayName}'`
    : `${input.profile.displayName}'s`;
  const detailedLabels: Record<string, string> = {
    "care_event.created": `A care record was added to ${possessive} shared profile.`,
    "care_event.updated": `A care record changed on ${possessive} shared profile.`,
    "care_plan.changed": `${possessive} shared care plan changed.`,
    "guideline_rule.updated": `Reviewed guidance changed ${possessive} shared care plan.`,
    "profile.sharing_updated": `Sharing changed for ${possessive} profile.`,
  };
  return detailedLabels[input.action] ?? redacted;
}
