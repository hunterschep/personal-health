import { Badge } from "@/components/ui/badge";
import type { SourceFreshnessState, SourceLifecycle } from "@/server/sources/types";

const freshnessCopy: Record<SourceFreshnessState, string> = {
  current: "Review current",
  review_due: "Review due",
  future: "Future effective",
  inactive: "Inactive",
};

export function SourceFreshnessBadge({ state }: { state: SourceFreshnessState }) {
  const tone =
    state === "current"
      ? "brand"
      : state === "review_due"
        ? "warm"
        : state === "future"
          ? "cool"
          : "neutral";
  return <Badge tone={tone}>{freshnessCopy[state]}</Badge>;
}

export function SourceLifecycleBadge({ lifecycle }: { lifecycle: SourceLifecycle }) {
  const tone = lifecycle === "current" ? "brand" : lifecycle === "future" ? "cool" : "neutral";
  return <Badge tone={tone}>{lifecycle.replaceAll("_", " ")}</Badge>;
}
