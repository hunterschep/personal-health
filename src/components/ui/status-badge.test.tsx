import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { recommendationStatusSchema, statusLabels, type RecommendationStatus } from "@/contracts";
import { StatusBadge } from "./status-badge";

const expectedLabels: Record<RecommendationStatus, string> = {
  future: "Coming later",
  up_to_date: "Up to date",
  due_this_year: "Recommended this year",
  due_soon: "Due soon",
  due_now: "Due now",
  overdue: "Past the recommended window",
  unknown_history: "History needed",
  needs_date_confirmation: "Date needs confirmation",
  discuss_with_clinician: "Discuss with a clinician",
  clinician_managed: "Follow personal clinician plan",
  not_routinely_recommended: "Not routinely recommended",
  not_applicable: "Not applicable",
  completed_once: "Completed",
};

describe("recommendation status presentation", () => {
  it("matches the frozen Part 01 language contract", () => {
    expect(statusLabels).toEqual(expectedLabels);
    expect(Object.keys(expectedLabels)).toEqual(recommendationStatusSchema.options);
  });

  it.each(recommendationStatusSchema.options)("renders %s with text and an icon", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabels[status])).toBeVisible();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not give ordinary due states the destructive treatment", () => {
    const { rerender } = render(<StatusBadge status="due_now" />);
    expect(screen.getByText("Due now").closest("span")).not.toHaveClass("bg-rose-soft");
    rerender(<StatusBadge status="due_soon" />);
    expect(screen.getByText("Due soon").closest("span")).not.toHaveClass("bg-rose-soft");
  });
});
