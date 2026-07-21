import { describe, expect, it } from "vitest";

import { recommendationReminderCopy, standaloneReminderCopy } from "./copy";
import {
  clinicianPlanReviewCandidate,
  customMaintenanceCandidate,
  medicationReviewCandidate,
  plannedActionCandidate,
  recommendationCandidate,
} from "./generate";
import { applyQuietTime } from "./preferences";
import { localDateKey, localDateTimeToInstant } from "./timezone";

describe("reminder scheduling", () => {
  it("converts local morning reminders across daylight-saving transitions", () => {
    expect(localDateTimeToInstant("2026-03-08", 9, 0, "America/Los_Angeles").toISOString()).toBe(
      "2026-03-08T16:00:00.000Z",
    );
    expect(localDateTimeToInstant("2026-11-01", 9, 0, "America/Los_Angeles").toISOString()).toBe(
      "2026-11-01T17:00:00.000Z",
    );
    expect(localDateKey(new Date("2026-11-01T07:30:00.000Z"), "America/Los_Angeles")).toBe(
      "2026-11-01",
    );
  });

  it("never generates reminders for excluded recommendation classes and statuses", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(
      recommendationCandidate(
        {
          id: "recommendation-1",
          profileId: "profile-1",
          status: "due_now",
          recommendationClass: "not_recommended",
          dueStart: now,
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
    expect(
      recommendationCandidate(
        {
          id: "recommendation-2",
          profileId: "profile-1",
          status: "not_applicable",
          recommendationClass: "routine",
          dueStart: now,
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
    expect(
      recommendationCandidate(
        {
          id: "recommendation-3",
          profileId: "profile-1",
          status: "discuss_with_clinician",
          recommendationClass: "selective",
          dueStart: now,
          activeOverrideId: null,
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
  });

  it("allows a selective reminder when a personal clinician plan exists", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(
      recommendationCandidate(
        {
          id: "recommendation-4",
          profileId: "profile-1",
          status: "clinician_managed",
          recommendationClass: "selective",
          dueStart: new Date("2026-09-10T00:00:00.000Z"),
          activeOverrideId: "override-1",
        },
        "America/Los_Angeles",
        now,
      ),
    ).toMatchObject({ remindAt: new Date("2026-09-10T16:00:00.000Z") });
  });

  it("uses one stable monthly dedupe key for overdue resurfacing", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const candidate = recommendationCandidate(
      {
        id: "recommendation-1",
        profileId: "profile-1",
        status: "overdue",
        recommendationClass: "routine",
        dueStart: new Date("2026-01-01T00:00:00.000Z"),
      },
      "America/Los_Angeles",
      now,
    );
    expect(candidate?.dedupeKey).toBe("recommendation:recommendation-1:overdue:2026-07");
    expect(candidate?.remindAt).toEqual(now);
  });

  it("generates a planning reminder and requires a user-selected offset for appointments", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const planned = plannedActionCandidate(
      {
        id: "action-1",
        profileId: "profile-1",
        plannedMonth: new Date("2026-09-01T00:00:00.000Z"),
        appointmentStart: null,
        timezone: "America/Los_Angeles",
        status: "planned",
      },
      "America/Los_Angeles",
    );
    const appointment = plannedActionCandidate(
      {
        id: "action-2",
        profileId: "profile-1",
        plannedMonth: null,
        appointmentStart: new Date("2026-09-10T16:00:00.000Z"),
        timezone: "America/Los_Angeles",
        status: "scheduled",
      },
      "America/Los_Angeles",
      7,
      now,
    );
    expect(planned?.remindAt.toISOString()).toBe("2026-09-01T16:00:00.000Z");
    expect(appointment).toMatchObject({
      plannedActionId: "action-2",
      remindAt: new Date("2026-09-03T16:00:00.000Z"),
      dedupeKey: "planned-action:action-2:appointment:2026-09-10T16:00:00.000Z:days-before:7",
    });
  });

  it("uses explicit personal dates for maintenance, medication, and clinician-plan reviews", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const maintenance = customMaintenanceCandidate(
      {
        id: "maintenance-1",
        profileId: "profile-1",
        status: "active",
        nextDate: new Date("2026-08-15T00:00:00.000Z"),
        reminderEnabled: true,
        reminderDaysBefore: 14,
      },
      "America/Los_Angeles",
      now,
    );
    const medication = medicationReviewCandidate(
      {
        id: "medication-1",
        profileId: "profile-1",
        status: "active",
        nextReviewDate: new Date("2026-09-01T00:00:00.000Z"),
        deletedAt: null,
      },
      "America/Los_Angeles",
      now,
    );
    const clinicianPlan = clinicianPlanReviewCandidate(
      {
        id: "override-1",
        profileId: "profile-1",
        active: true,
        reviewDate: new Date("2026-10-15T00:00:00.000Z"),
      },
      "America/Los_Angeles",
      now,
      "recommendation-1",
    );

    expect(maintenance).toMatchObject({
      remindAt: new Date("2026-08-01T16:00:00.000Z"),
      dedupeKey: "custom-maintenance:maintenance-1:2026-08-15:days-before:14",
    });
    expect(medication).toMatchObject({
      remindAt: new Date("2026-09-01T16:00:00.000Z"),
      dedupeKey: "medication-review:medication-1:2026-09-01",
    });
    expect(clinicianPlan).toMatchObject({
      remindAt: new Date("2026-10-15T16:00:00.000Z"),
      dedupeKey: "clinician-plan-review:override-1:2026-10-15",
      recommendationInstanceId: "recommendation-1",
    });
  });

  it("does not infer review prompts without an eligible explicit date or opt-in", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(
      customMaintenanceCandidate(
        {
          id: "maintenance-1",
          profileId: "profile-1",
          status: "active",
          nextDate: new Date("2026-08-15T00:00:00.000Z"),
          reminderEnabled: false,
          reminderDaysBefore: null,
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
    expect(
      medicationReviewCandidate(
        {
          id: "medication-1",
          profileId: "profile-1",
          status: "ended",
          nextReviewDate: new Date("2026-09-01T00:00:00.000Z"),
          deletedAt: null,
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
    expect(
      clinicianPlanReviewCandidate(
        {
          id: "override-1",
          profileId: "profile-1",
          active: false,
          reviewDate: new Date("2026-10-15T00:00:00.000Z"),
        },
        "America/Los_Angeles",
        now,
      ),
    ).toBeNull();
  });

  it("moves reminders out of quiet hours and quiet days", () => {
    expect(
      applyQuietTime(new Date("2026-07-22T06:30:00.000Z"), {
        quietDays: [],
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        timezone: "America/Los_Angeles",
      }).toISOString(),
    ).toBe("2026-07-22T14:00:00.000Z");
    expect(
      applyQuietTime(new Date("2026-07-19T16:00:00.000Z"), {
        quietDays: [0],
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: "America/Los_Angeles",
      }).toISOString(),
    ).toBe("2026-07-20T16:00:00.000Z");
  });
});

describe("reminder language", () => {
  it("uses discussion language instead of overdue language for shared decisions", () => {
    const copy = recommendationReminderCopy(
      "shared_decision",
      "overdue",
      "Prostate cancer screening",
    );
    expect(copy.detail).toContain("Consider discussing");
    expect(copy.detail.toLocaleLowerCase("en-US")).not.toContain("overdue");
    expect(copy.emailText).toBe("Consider discussing a care plan item at your next visit.");
  });

  it("keeps email text neutral even when clinician instructions are detailed", () => {
    const copy = recommendationReminderCopy(
      "routine",
      "clinician_managed",
      "Follow-up",
      "Repeat imaging after abnormal result",
    );
    expect(copy.detail).toContain("Repeat imaging");
    expect(copy.emailText).toBe("A personal clinician-plan review is coming up.");
    expect(copy.emailText.toLocaleLowerCase("en-US")).not.toContain("abnormal");
  });

  it("keeps standalone personal reminder copy neutral and value-free", () => {
    expect(standaloneReminderCopy("medication-review:private-id:2026-09-01")).toEqual({
      title: "Medication review reminder",
      detail: "A personal medication review is coming up.",
      emailText: "A personal medication review is coming up.",
    });
    expect(standaloneReminderCopy("custom-maintenance:private-id:2026-09-01").detail).not.toContain(
      "private-id",
    );
  });
});
