import { describe, expect, it } from "vitest";

import {
  customMaintenanceCalendarEvent,
  plannedActionCalendarEvent,
  recommendationCalendarEvent,
  reminderCalendarEvent,
} from "./events";
import { createIcs, foldIcsLine } from "./ics";

describe("RFC 5545 calendar export", () => {
  it("exports appointment instants in UTC while retaining the planning timezone", () => {
    const event = plannedActionCalendarEvent(
      {
        id: "action-1",
        profileId: "profile-1",
        plannedMonth: null,
        appointmentStart: new Date("2026-11-01T16:30:00.000Z"),
        appointmentEnd: new Date("2026-11-01T17:15:00.000Z"),
        timezone: "America/Los_Angeles",
        location: "Example Clinic, Suite 2",
        updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      },
      "https://care.example.test",
    );
    expect(event).not.toBeNull();
    const ics = createIcs(event === null ? [] : [event], new Date("2026-07-21T12:00:00.000Z"));

    expect(ics).toContain("DTSTART:20261101T163000Z\r\n");
    expect(ics).toContain("DTEND:20261101T171500Z\r\n");
    expect(ics).toContain("X-CARECADENCE-TIMEZONE:America/Los_Angeles\r\n");
    expect(ics).toContain("LOCATION:Example Clinic\\, Suite 2\r\n");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("uses exclusive DTEND for all-day recommendation ranges and neutral copy", () => {
    const event = recommendationCalendarEvent({
      id: "recommendation-1",
      profileId: "profile-1",
      dueStart: new Date("2026-10-01T00:00:00.000Z"),
      dueEnd: new Date("2026-10-31T00:00:00.000Z"),
      updatedAt: new Date("2026-07-21T12:00:00.000Z"),
    });
    const ics = createIcs(event === null ? [] : [event], new Date("2026-07-21T12:00:00.000Z"));

    expect(ics).toContain("DTSTART;VALUE=DATE:20261001");
    expect(ics).toContain("DTEND;VALUE=DATE:20261101");
    expect(ics).toContain("SUMMARY:Care plan timing");
    expect(ics.toLocaleLowerCase("en-US")).not.toContain("diagnosis");
    expect(ics.toLocaleLowerCase("en-US")).not.toContain("abnormal");
  });

  it("keeps selected reminders and personal cadences neutral", () => {
    const reminder = reminderCalendarEvent(
      {
        id: "reminder-1",
        profileId: "profile-1",
        remindAt: new Date("2026-08-10T16:00:00.000Z"),
        updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      },
      "America/Los_Angeles",
    );
    const maintenance = customMaintenanceCalendarEvent({
      id: "maintenance-1",
      profileId: "profile-1",
      nextDate: new Date("2026-09-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-21T12:00:00.000Z"),
    });
    const ics = createIcs(
      maintenance === null ? [reminder] : [reminder, maintenance],
      new Date("2026-07-21T12:00:00.000Z"),
    );

    expect(ics).toContain("SUMMARY:Care reminder");
    expect(ics).toContain("X-CARECADENCE-TIMEZONE:America/Los_Angeles");
    expect(ics).toContain("SUMMARY:Personal care cadence");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260914");
    expect(ics).not.toMatch(/Annual checkup|Dental care|medication|diagnosis|abnormal/i);
  });

  it("folds long Unicode content at 75 octets or fewer", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"é".repeat(100)}`);
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(folded.split("\r\n")[1]?.startsWith(" ")).toBe(true);
  });
});
