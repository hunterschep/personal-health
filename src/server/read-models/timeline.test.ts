import { describe, expect, it } from "vitest";
import {
  customMaintenanceTimelineEntry,
  filterTimelineEntries,
  timelineDateLabels,
  type TimelineEntry,
} from "./timeline";

function timelineEntry(
  overrides: Partial<TimelineEntry> & Pick<TimelineEntry, "id" | "sortDate">,
): TimelineEntry {
  const { id, sortDate, ...changes } = overrides;
  return {
    id,
    kind: "care_event",
    title: "Synthetic care event",
    description: "Synthetic entry for a pure filter test.",
    sortDate,
    yearLabel: sortDate.slice(0, 4),
    dateLabel: sortDate,
    precision: "day",
    approximate: false,
    current: false,
    future: false,
    category: "cancer_screening",
    href: null,
    ...changes,
  };
}

describe("timeline read model formatting", () => {
  it("preserves month, year, and unknown date precision", () => {
    expect(timelineDateLabels("2024-03-01", "2024-03-31", "month")).toEqual({
      yearLabel: "2024",
      dateLabel: "March 2024",
      approximate: true,
    });
    expect(timelineDateLabels("2021-01-01", "2021-12-31", "year")).toEqual({
      yearLabel: "2021",
      dateLabel: "Year only",
      approximate: true,
    });
    expect(timelineDateLabels(null, null, "unknown")).toEqual({
      yearLabel: "Unknown",
      dateLabel: "Date unknown",
      approximate: true,
    });
  });

  it("filters by period, entry type, and category without changing entries", () => {
    const entries = [
      timelineEntry({ id: "past", sortDate: "2022-07-21" }),
      timelineEntry({
        id: "future",
        sortDate: "2028-07-21",
        kind: "milestone",
        category: "immunization",
        future: true,
      }),
      timelineEntry({ id: "far", sortDate: "2035-07-21", kind: "milestone", future: true }),
    ];
    expect(
      filterTimelineEntries(
        entries,
        { period: "future-five", type: "milestone", category: "immunization" },
        "2026-07-21",
      ).map((entry) => entry.id),
    ).toEqual(["future"]);
    expect(entries).toHaveLength(3);
  });

  it("adds only future custom maintenance as a precise personal-cadence milestone", () => {
    const milestone = customMaintenanceTimelineEntry({
      id: "maintenance-1",
      profileId: "profile-1",
      title: "Dental care",
      category: "Dental",
      source: "personal",
      nextDate: "2026-10-15",
      asOfDate: "2026-07-21",
    });

    expect(milestone).toMatchObject({
      id: "custom-maintenance-maintenance-1",
      kind: "custom_maintenance",
      title: "Dental care personal cadence",
      sortDate: "2026-10-15",
      dateLabel: "Oct 15, 2026",
      precision: "day",
      approximate: false,
      future: true,
      category: "Dental",
      href: "/app/profile/profile-1/maintenance",
    });
    expect(milestone?.description).toContain("not a guideline deadline");
    expect(
      customMaintenanceTimelineEntry({
        id: "maintenance-today",
        profileId: "profile-1",
        title: "Same-day cadence",
        category: "Other",
        source: "clinician",
        nextDate: "2026-07-21",
        asOfDate: "2026-07-21",
      }),
    ).toBeNull();
  });
});
