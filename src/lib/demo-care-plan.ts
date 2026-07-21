import type { RecommendationCardData } from "@/components/care-plan/recommendation-card";

export const demoRecommendations: RecommendationCardData[] = [
  {
    id: "colorectal-cancer-screening",
    service: "Colorectal cancer screening",
    category: "Cancer screening",
    status: "due_now",
    timing: "Eligible now",
    reason:
      "Average-risk screening begins at age 45. The future interval depends on the method actually completed.",
    history: "No history recorded",
    source: "USPSTF · 2021",
  },
  {
    id: "tdap-td-vaccine",
    service: "Tetanus-containing vaccine",
    category: "Immunization",
    status: "needs_date_confirmation",
    timing: "Due range begins in 2027",
    reason:
      "A year-only record creates a due range. Confirming the month or day will make this plan more accurate.",
    history: "Recorded in 2017 · year only",
    source: "CDC / ACIP",
  },
  {
    id: "blood-pressure-screening",
    service: "Blood pressure screening",
    category: "Cardiometabolic",
    status: "due_this_year",
    timing: "Anytime this year",
    reason:
      "Routine screening applies, with the interval based on age, prior normal measurements, and risk context.",
    history: "Last recorded May 2025",
    source: "USPSTF · 2021",
    planned: true,
  },
  {
    id: "prostate-cancer-discussion",
    service: "Prostate cancer screening discussion",
    category: "Cancer screening",
    status: "discuss_with_clinician",
    timing: "Conversation window: ages 55–69",
    reason:
      "At age 57, PSA screening is an individual decision. CareCadence does not assign an automatic annual test.",
    history: "No conversation recorded",
    source: "USPSTF · Grade C",
    recommendationClass: "shared-decision",
  },
  {
    id: "influenza-vaccine",
    service: "Seasonal influenza vaccine",
    category: "Immunization",
    status: "future",
    timing: "Plan for the next supported season",
    reason:
      "Seasonal guidance is versioned. Product and safety choices remain a clinician or pharmacist discussion.",
    history: "Completed October 2025",
    source: "CDC / ACIP",
  },
  {
    id: "hepatitis-c-screening",
    service: "Hepatitis C screening",
    category: "Infectious disease",
    status: "completed_once",
    timing: "One-time routine screen complete",
    reason:
      "A qualifying negative record completes the routine one-time pathway when ongoing risk is absent.",
    history: "Completed March 2024",
    source: "USPSTF · Grade B",
  },
];
