import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProfileCarePlan: vi.fn(),
  medications: vi.fn(),
  conditions: vi.fn(),
  careEvents: vi.fn(),
  overrides: vi.fn(),
  appointments: vi.fn(),
  preference: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    medication: { findMany: mocks.medications },
    condition: { findMany: mocks.conditions },
    careEvent: { findMany: mocks.careEvents },
    clinicianOverride: { findMany: mocks.overrides },
    plannedAction: { findMany: mocks.appointments },
    visitPrepPreference: { findUnique: mocks.preference },
  },
}));

vi.mock("@/server/auth/session", () => ({ requireSession: mocks.requireSession }));

vi.mock("./profiles", () => ({
  displayDateRange: (start: Date | null, end: Date | null) =>
    start === null || end === null
      ? "Timing depends on history or a conversation"
      : `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
  loadProfileCarePlan: mocks.loadProfileCarePlan,
}));

import {
  formatVisitPrepAppointment,
  formatVisitPrepEventDate,
  loadVisitPrepData,
} from "./visit-prep";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-21T16:00:00.000Z"));
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ user: { id: "viewer-1" } });
  mocks.preference.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("visit-prep formatting", () => {
  it("keeps an appointment's exact local date, time range, and timezone", () => {
    const result = formatVisitPrepAppointment(
      new Date("2026-07-21T16:30:00.000Z"),
      new Date("2026-07-21T17:15:00.000Z"),
      "America/Los_Angeles",
    );

    expect(result).toBe("Tuesday, July 21, 2026 at 9:30 AM PDT until 10:15 AM PDT");
  });

  it("preserves honest care-event date precision", () => {
    const date = new Date("2024-06-17T00:00:00.000Z");

    expect(formatVisitPrepEventDate(date, "day")).toBe("Jun 17, 2024");
    expect(formatVisitPrepEventDate(date, "month")).toBe("June 2024");
    expect(formatVisitPrepEventDate(date, "year")).toBe("2024");
    expect(formatVisitPrepEventDate(null, "unknown")).toBe("date unknown");
  });
});

describe("loadVisitPrepData", () => {
  it("loads only the authorized profile and minimizes printable record details", async () => {
    mocks.loadProfileCarePlan.mockResolvedValue({
      profile: {
        id: "authorized-profile",
        displayName: "Alex",
        dateOfBirth: new Date("1980-04-10T00:00:00.000Z"),
        timezone: "America/Los_Angeles",
      },
      capabilities: { canExport: true, canEdit: true },
      recommendations: [
        {
          service: "Blood pressure",
          status: "due_now",
          timing: "Due now",
          recommendationClass: "routine",
          source: "Reviewed source",
          sourceUrl: "https://example.test/source",
        },
        {
          service: "Influenza vaccine",
          status: "due_this_year",
          timing: "Sep 1, 2026 to Nov 30, 2026",
          recommendationClass: "routine",
          source: "Reviewed source",
          sourceUrl: "https://example.test/source",
        },
        {
          service: "Prostate cancer screening",
          status: "discuss_with_clinician",
          timing: "Discuss based on preferences",
          recommendationClass: "shared-decision",
          source: "Reviewed source",
          sourceUrl: "https://example.test/source",
        },
        {
          service: "Lipid monitoring",
          status: "clinician_managed",
          timing: "Follow the personal clinician plan",
          recommendationClass: "routine",
          source: "Reviewed source",
          sourceUrl: "https://example.test/source",
        },
      ],
    });
    mocks.medications.mockResolvedValue([
      { name: "Atorvastatin", dose: "10 mg", frequency: "daily" },
    ]);
    mocks.conditions.mockResolvedValue([{ displayName: "Hypertension" }]);
    mocks.careEvents.mockResolvedValue([
      {
        service: { name: "Colorectal cancer screening" },
        method: { name: "Colonoscopy" },
        result: "inconclusive",
        performedStart: new Date("2026-06-01T00:00:00.000Z"),
        datePrecision: "month",
        providerName: "Hidden provider",
        notes: "Hidden private note",
      },
    ]);
    mocks.overrides.mockResolvedValue([
      {
        service: { name: "Lipid monitoring" },
        overrideType: "exact_next_date",
        nextDueStart: new Date("2026-09-01T00:00:00.000Z"),
        nextDueEnd: new Date("2026-09-30T00:00:00.000Z"),
      },
    ]);
    mocks.appointments.mockResolvedValue([
      {
        title: "Primary care visit",
        appointmentStart: new Date("2026-07-28T16:30:00.000Z"),
        appointmentEnd: new Date("2026-07-28T17:15:00.000Z"),
        timezone: "America/Los_Angeles",
        location: "Downtown clinic",
        notes: "Hidden appointment note",
      },
    ]);

    const result = await loadVisitPrepData("requested-profile");

    expect(mocks.loadProfileCarePlan).toHaveBeenCalledWith("requested-profile");
    for (const query of [
      mocks.medications,
      mocks.conditions,
      mocks.careEvents,
      mocks.overrides,
      mocks.appointments,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ profileId: "authorized-profile" }),
        }),
      );
    }
    expect(mocks.overrides).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, pausedAt: null }),
      }),
    );
    expect(result).toMatchObject({
      profileId: "authorized-profile",
      canExport: true,
      canSave: true,
      draft: null,
      data: {
        profileName: "Alex",
        age: 46,
        medications: ["Atorvastatin · 10 mg · daily"],
        conditions: ["Hypertension"],
        attention: ["Blood pressure: Due now."],
        thisYear: ["Influenza vaccine: Sep 1, 2026 to Nov 30, 2026."],
        discussion: ["Prostate cancer screening: Discuss based on preferences."],
        appointments: [
          {
            title: "Primary care visit",
            timing: "Tuesday, July 28, 2026 at 9:30 AM PDT until 10:15 AM PDT",
            timezone: "America/Los_Angeles",
            location: "Downtown clinic",
          },
        ],
        recentEvents: [
          "Colorectal cancer screening · Colonoscopy: Inconclusive result recorded · June 2026. No interpretation added.",
        ],
        personalNotes: [],
        sourceLinks: [{ label: "Reviewed source", url: "https://example.test/source" }],
      },
    });
    expect(JSON.stringify(result.data)).not.toContain("Hidden provider");
    expect(JSON.stringify(result.data)).not.toContain("Hidden private note");
    expect(JSON.stringify(result.data)).not.toContain("Hidden appointment note");
  });
});
