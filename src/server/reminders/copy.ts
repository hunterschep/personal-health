import type { RecommendationClass, RecommendationStatus } from "@/generated/prisma/client";

export type ReminderCopy = { title: string; detail: string; emailText: string };

export function recommendationReminderCopy(
  recommendationClass: RecommendationClass,
  status: RecommendationStatus,
  serviceName?: string,
  clinicianInstruction?: string | null,
): ReminderCopy {
  const serviceDetail = serviceName === undefined ? "this care plan item" : serviceName;
  if (recommendationClass === "shared_decision" || status === "discuss_with_clinician") {
    return {
      title: "Consider discussing a care plan item",
      detail: `Consider discussing ${serviceDetail} at your next visit.`,
      emailText: "Consider discussing a care plan item at your next visit.",
    };
  }
  if (status === "clinician_managed") {
    return {
      title: "Personal clinician-plan review",
      detail: clinicianInstruction?.trim() || "A personal clinician-plan review is coming up.",
      emailText: "A personal clinician-plan review is coming up.",
    };
  }
  if (status === "unknown_history" || status === "needs_date_confirmation") {
    return {
      title: "Care history date needs confirmation",
      detail: `The date for ${serviceDetail} needs confirmation.`,
      emailText: "A date in your care history needs confirmation.",
    };
  }
  return {
    title: "Care plan timing reminder",
    detail: `${serviceDetail} may be due this year.`,
    emailText: "A care plan item may be due this year.",
  };
}

export function plannedActionReminderCopy(hasAppointment: boolean): ReminderCopy {
  return hasAppointment
    ? {
        title: "Upcoming health appointment",
        detail: "A health appointment in your personal plan is coming up.",
        emailText: "A health appointment reminder is ready.",
      }
    : {
        title: "Personal care planning reminder",
        detail: "A personal care planning item is coming up.",
        emailText: "A personal care planning reminder is ready.",
      };
}

export function standaloneReminderCopy(dedupeKey: string): ReminderCopy {
  if (dedupeKey.startsWith("medication-review:")) {
    return {
      title: "Medication review reminder",
      detail: "A personal medication review is coming up.",
      emailText: "A personal medication review is coming up.",
    };
  }
  if (dedupeKey.startsWith("clinician-plan-review:")) {
    return {
      title: "Personal clinician-plan review",
      detail: "A personal clinician-plan review is coming up.",
      emailText: "A personal clinician-plan review is coming up.",
    };
  }
  if (dedupeKey.startsWith("custom-maintenance:")) {
    return {
      title: "Personal maintenance reminder",
      detail: "A personally chosen health-maintenance date is coming up.",
      emailText: "A personal health-maintenance reminder is ready.",
    };
  }
  return plannedActionReminderCopy(false);
}
