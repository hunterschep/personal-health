import { CalendarClock, Check, CircleHelp, MessageCircle, ShieldCheck } from "lucide-react";
import { statusLabels, type RecommendationStatus } from "@/contracts";
import { Badge } from "./badge";

const toneByStatus: Record<
  RecommendationStatus,
  "neutral" | "brand" | "warm" | "cool" | "critical"
> = {
  future: "neutral",
  up_to_date: "brand",
  due_this_year: "cool",
  due_soon: "warm",
  due_now: "warm",
  overdue: "critical",
  unknown_history: "neutral",
  needs_date_confirmation: "warm",
  discuss_with_clinician: "cool",
  clinician_managed: "cool",
  not_routinely_recommended: "neutral",
  not_applicable: "neutral",
  completed_once: "brand",
};

function StatusIcon({ status }: { status: RecommendationStatus }) {
  if (status === "up_to_date" || status === "completed_once") return <Check aria-hidden="true" />;
  if (status === "unknown_history" || status === "needs_date_confirmation") {
    return <CircleHelp aria-hidden="true" />;
  }
  if (status === "discuss_with_clinician" || status === "clinician_managed") {
    return <MessageCircle aria-hidden="true" />;
  }
  if (status === "not_applicable" || status === "not_routinely_recommended") {
    return <ShieldCheck aria-hidden="true" />;
  }
  return <CalendarClock aria-hidden="true" />;
}

export function StatusBadge({ status }: { status: RecommendationStatus }) {
  return (
    <Badge tone={toneByStatus[status]}>
      <StatusIcon status={status} />
      {statusLabels[status]}
    </Badge>
  );
}
