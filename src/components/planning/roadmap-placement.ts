export type RoadmapBucket = "anytime" | "confirmation" | "future";

export function recommendationRoadmapPlacement(
  status: string,
  dueStart: Date | null,
  year: number,
): { month: number | null; bucket: RoadmapBucket | null } {
  if (status === "needs_date_confirmation") {
    return { month: null, bucket: "confirmation" };
  }
  if (status === "due_this_year") return { month: null, bucket: "anytime" };
  if (dueStart === null) {
    return { month: null, bucket: status === "future" ? "future" : "confirmation" };
  }
  const dueYear = dueStart.getUTCFullYear();
  if (dueYear === year) return { month: dueStart.getUTCMonth(), bucket: null };
  return {
    month: null,
    bucket: status === "future" || dueYear > year ? "future" : "anytime",
  };
}
