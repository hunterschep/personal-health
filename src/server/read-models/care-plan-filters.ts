import type { RecommendationStatus } from "@/contracts";

export const carePlanStatusGroups: Record<string, readonly RecommendationStatus[]> = {
  attention: ["overdue", "due_now", "needs_date_confirmation"],
  "this-year": ["due_soon", "due_this_year"],
  unknown: ["unknown_history"],
  discussion: ["discuss_with_clinician", "clinician_managed", "not_routinely_recommended"],
  current: ["up_to_date", "completed_once"],
  coming: ["future"],
  "not-applicable": ["not_applicable"],
};

export type CarePlanFilterInput = {
  query?: string;
  status?: string;
  category?: string;
  year?: string;
  recommendationClass?: string;
  source?: string;
  planned?: string;
  history?: string;
};

export type FilterableRecommendation = {
  service: string;
  status: RecommendationStatus;
  categoryKey: string;
  dueStart: Date | null;
  recommendationClass: string;
  sourceOrganization: string;
  planned: boolean;
  knownHistory: boolean;
};

export function filterCarePlanRecommendations<T extends FilterableRecommendation>(
  recommendations: readonly T[],
  filters: CarePlanFilterInput,
): T[] {
  const query = filters.query?.trim().toLocaleLowerCase("en-US") ?? "";
  return recommendations.filter((recommendation) => {
    if (query !== "" && !recommendation.service.toLocaleLowerCase("en-US").includes(query)) {
      return false;
    }
    if (filters.status !== undefined && filters.status !== "all") {
      const statuses = carePlanStatusGroups[filters.status];
      if (statuses !== undefined && !statuses.includes(recommendation.status)) return false;
    }
    if (
      filters.category !== undefined &&
      filters.category !== "all" &&
      recommendation.categoryKey !== filters.category
    ) {
      return false;
    }
    if (filters.year !== undefined && filters.year !== "all") {
      const year = recommendation.dueStart?.getUTCFullYear();
      if (filters.year === "unknown" ? year !== undefined : String(year) !== filters.year) {
        return false;
      }
    }
    if (
      filters.recommendationClass !== undefined &&
      filters.recommendationClass !== "all" &&
      recommendation.recommendationClass !== filters.recommendationClass
    ) {
      return false;
    }
    if (
      filters.source !== undefined &&
      filters.source !== "all" &&
      recommendation.sourceOrganization !== filters.source
    ) {
      return false;
    }
    if (filters.planned === "planned" && !recommendation.planned) return false;
    if (filters.planned === "unplanned" && recommendation.planned) return false;
    if (filters.history === "known" && !recommendation.knownHistory) return false;
    if (filters.history === "unknown" && recommendation.knownHistory) return false;
    return true;
  });
}
