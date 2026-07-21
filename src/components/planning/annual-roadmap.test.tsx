import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnnualRoadmap,
  roadmapDayInMonth,
  roadmapItemAppearsInMonth,
  type RoadmapPlan,
} from "./annual-roadmap";
import { recommendationRoadmapPlacement } from "./roadmap-placement";

const plan: RoadmapPlan = {
  id: "30000000-0000-4000-8000-000000000001",
  title: "Annual checkup",
  month: 6,
  bucket: null,
  status: "appointment",
  timing: "Jul 21, 2026, 9:30 AM",
  serviceId: "30000000-0000-4000-8000-000000000002",
  recommendationId: "30000000-0000-4000-8000-000000000003",
  persisted: true,
  startDate: "2026-07-21",
  endDate: "2026-07-21",
  appointmentStartLocal: "2026-07-21T09:30",
  appointmentEndLocal: "2026-07-21T10:15",
  reminderDaysBefore: 7,
  location: "Downtown clinic",
  notes: "Bring prior records",
  detailHref: null,
};

const reminder: RoadmapPlan = {
  id: "reminder-30000000-0000-4000-8000-000000000004",
  title: "Annual checkup reminder",
  month: 6,
  bucket: null,
  status: "reminder",
  timing: "Reminder set for Jul 14, 2026, 9:00 AM",
  serviceId: null,
  recommendationId: null,
  persisted: false,
  startDate: "2026-07-14",
  endDate: null,
  appointmentStartLocal: null,
  appointmentEndLocal: null,
  reminderDaysBefore: null,
  location: null,
  notes: null,
  detailHref: "/app/reminders",
};

const maintenance: RoadmapPlan = {
  id: "maintenance-30000000-0000-4000-8000-000000000005",
  title: "Dental care",
  month: 6,
  bucket: null,
  status: "maintenance",
  timing: "Jul 30, 2026 · Personal cadence, not a guideline deadline",
  serviceId: null,
  recommendationId: null,
  persisted: false,
  startDate: "2026-07-30",
  endDate: null,
  appointmentStartLocal: null,
  appointmentEndLocal: null,
  reminderDaysBefore: null,
  location: null,
  notes: null,
  detailHref: "/app/profile/profile-1/maintenance",
};

const medical: RoadmapPlan = {
  id: "recommendation-30000000-0000-4000-8000-000000000006",
  title: "Blood pressure screening",
  month: 8,
  bucket: null,
  status: "medical",
  timing: "Sep 1–30, 2026",
  serviceId: "30000000-0000-4000-8000-000000000007",
  recommendationId: "30000000-0000-4000-8000-000000000006",
  persisted: false,
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  appointmentStartLocal: null,
  appointmentEndLocal: null,
  reminderDaysBefore: null,
  location: null,
  notes: null,
  detailHref: "/app/profile/profile-1/care-plan/30000000-0000-4000-8000-000000000006",
};

describe("AnnualRoadmap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults persisted details and sends local wall times without a client timezone", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ ok: true, action: { id: plan.id } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRoadmap(true);

    expect(screen.getByLabelText("Appointment start (optional)")).toHaveValue("2026-07-21T09:30");
    expect(screen.getByLabelText("Appointment end (optional)")).toHaveValue("2026-07-21T10:15");
    expect(screen.getByLabelText("Location (optional)")).toHaveValue("Downtown clinic");
    expect(screen.getByLabelText("Private notes (optional)")).toHaveValue("Bring prior records");
    expect(screen.getByLabelText("Appointment reminder (optional)")).toHaveValue("7");

    await userEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("Expected the save request.");
    const [endpoint, request] = call;
    expect(endpoint).toBe(`/api/profiles/profile-1/planned-actions/${plan.id}`);
    const payload = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      appointmentStart: "2026-07-21T09:30",
      appointmentEnd: "2026-07-21T10:15",
      location: "Downtown clinic",
      notes: "Bring prior records",
      reminderDaysBefore: 7,
    });
    expect(payload).not.toHaveProperty("timezone");
  });

  it("shows plan details without mutation controls in read-only mode", () => {
    renderRoadmap(false, false);

    expect(screen.getByText("View-only access")).toBeVisible();
    expect(screen.getByText("Downtown clinic")).toBeVisible();
    expect(screen.getByText("Bring prior records")).toBeVisible();
    expect(screen.getAllByText("Appointment").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Calendar file" })).not.toBeInTheDocument();
  });

  it("does not expose an ICS download to an editor without export access", () => {
    renderRoadmap(true, false);

    expect(screen.getByRole("button", { name: "Save plan" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Calendar file" })).not.toBeInTheDocument();
  });

  it("exports only explicitly selected roadmap items", async () => {
    const user = userEvent.setup();
    renderRoadmap(true, true, [plan, medical, reminder, maintenance]);

    expect(screen.getByRole("button", { name: "Export selected" })).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: "Select Annual checkup for calendar export" }),
    );
    expect(screen.getByRole("link", { name: "Export selected (1)" })).toHaveAttribute(
      "href",
      `/api/profiles/profile-1/calendar.ics?item=planned%3A${plan.id}`,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: "Select Blood pressure screening for calendar export",
      }),
    );
    expect(screen.getByRole("link", { name: "Export selected (2)" })).toHaveAttribute(
      "href",
      `/api/profiles/profile-1/calendar.ics?item=planned%3A${plan.id}&item=recommendation%3A${medical.recommendationId}`,
    );
    expect(
      screen.getByRole("checkbox", { name: "Select Annual checkup reminder for calendar export" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select Dental care for calendar export" }),
    ).not.toBeChecked();
  });

  it("opens the keyboard-accessible month view on the current profile month", async () => {
    const user = userEvent.setup();
    renderRoadmap(true, true, [plan, reminder, maintenance]);

    const monthTab = screen.getByRole("tab", { name: "Month" });
    monthTab.focus();
    await user.keyboard("{Enter}");

    expect(monthTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "July 2026" })).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "July 21, 2026" })).getByRole("button", {
        name: /Appointment: Annual checkup/,
      }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "July 14, 2026" })).getByRole("button", {
        name: /Reminder: Annual checkup reminder/,
      }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "July 30, 2026" })).getByRole("button", {
        name: /Personal cadence: Dental care/,
      }),
    ).toBeVisible();
  });

  it("places a spanning medical range only in its earliest month without inventing a day", () => {
    const spanning = {
      ...medical,
      month: 8,
      timing: "Sep 15, 2026 – Oct 15, 2026",
      startDate: "2026-09-15",
      endDate: "2026-10-15",
    };
    const exact = {
      ...medical,
      startDate: "2026-09-15",
      endDate: "2026-09-15",
    };

    expect(roadmapItemAppearsInMonth(spanning, 8)).toBe(true);
    expect(roadmapItemAppearsInMonth(spanning, 9)).toBe(false);
    expect(roadmapDayInMonth(spanning, 2026, 8)).toBeNull();
    expect(roadmapDayInMonth(exact, 2026, 8)).toBe(15);

    renderRoadmap(true, true, [spanning]);
    expect(
      screen.getByRole("button", {
        name: /Medical timing: Blood pressure screening\. Sep 15, 2026 – Oct 15, 2026/,
      }),
    ).toBeVisible();
  });

  it("keeps annual, confirmation, and future items in distinct roadmap buckets", () => {
    const unscheduled = (overrides: Partial<RoadmapPlan>): RoadmapPlan => ({
      ...medical,
      month: null,
      startDate: null,
      endDate: null,
      ...overrides,
    });
    renderRoadmap(true, true, [
      unscheduled({
        id: "anytime-item",
        title: "Flexible annual item",
        bucket: "anytime",
      }),
      unscheduled({
        id: "confirmation-item",
        title: "History date question",
        bucket: "confirmation",
      }),
      unscheduled({
        id: "future-item",
        title: "Later age milestone",
        bucket: "future",
      }),
    ]);

    expect(
      within(screen.getByRole("region", { name: "Anytime this year" })).getByRole("button", {
        name: /Flexible annual item/,
      }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Date needs confirmation" })).getByRole("button", {
        name: /History date question/,
      }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Unscheduled future" })).getByRole("button", {
        name: /Later age milestone/,
      }),
    ).toBeVisible();
  });

  it("derives a complete bucket or month placement from recommendation timing", () => {
    expect(
      recommendationRoadmapPlacement(
        "needs_date_confirmation",
        new Date("2026-09-01T00:00:00.000Z"),
        2026,
      ),
    ).toEqual({ month: null, bucket: "confirmation" });
    expect(
      recommendationRoadmapPlacement("due_this_year", new Date("2026-09-01T00:00:00.000Z"), 2026),
    ).toEqual({ month: null, bucket: "anytime" });
    expect(
      recommendationRoadmapPlacement("overdue", new Date("2025-09-01T00:00:00.000Z"), 2026),
    ).toEqual({ month: null, bucket: "anytime" });
    expect(
      recommendationRoadmapPlacement("future", new Date("2027-09-01T00:00:00.000Z"), 2026),
    ).toEqual({ month: null, bucket: "future" });
    expect(recommendationRoadmapPlacement("future", null, 2026)).toEqual({
      month: null,
      bucket: "future",
    });
    expect(
      recommendationRoadmapPlacement("due_soon", new Date("2026-09-01T00:00:00.000Z"), 2026),
    ).toEqual({ month: 8, bucket: null });
  });

  it("keeps reminders and custom maintenance informational for an editor", async () => {
    const user = userEvent.setup();
    renderRoadmap(true, true, [reminder, maintenance]);
    await user.click(screen.getByRole("button", { name: /Reminder: Annual checkup reminder/ }));

    expect(screen.getByText("Reminder only")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View related details" })).toHaveAttribute(
      "href",
      "/app/reminders",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Reminder only")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Personal cadence: Dental care/ }));
    expect(screen.getByText("Personal cadence, not universal guidance")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  });
});

function renderRoadmap(
  editable: boolean,
  exportable = editable,
  initialPlans: RoadmapPlan[] = [plan],
) {
  return render(
    <AnnualRoadmap
      profileId="profile-1"
      timezone="America/Los_Angeles"
      year={2026}
      currentMonth={6}
      initialPlans={initialPlans}
      {...(initialPlans.length === 1 && initialPlans[0]?.id === plan.id
        ? { initialSelectedId: plan.id }
        : {})}
      editable={editable}
      exportable={exportable}
    />,
  );
}
