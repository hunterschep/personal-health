import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CUSTOM_LAB_WARNING } from "@/domain/custom-maintenance/constants";

import { CustomMaintenanceManager } from "./custom-maintenance-manager";

describe("CustomMaintenanceManager", () => {
  it("always displays the non-universal warning with a custom lab bundle", () => {
    render(
      <CustomMaintenanceManager
        profileId="profile-1"
        profileName="Sam"
        canEdit={false}
        canUseOwnerOnly={false}
        initialTemplates={[]}
        initialItems={[
          {
            id: "maintenance-1",
            templateServiceId: null,
            title: "Clinician labs",
            category: "Labs",
            purpose: "A plan from the last visit.",
            kind: "lab_bundle",
            source: "clinician",
            sourceLabel: "Clinician instruction",
            clinicianName: "Dr. Rivera",
            practiceName: null,
            cadenceValue: 6,
            cadenceUnit: "months",
            cadenceLabel: "Every 6 months",
            startDate: null,
            stopDate: null,
            nextDate: "2026-11-01",
            timingState: "scheduled",
            reminderEnabled: true,
            reminderDaysBefore: 14,
            visibility: "profile_access",
            visibilityLabel: "People with profile access",
            notes: null,
            status: "active",
            warning: CUSTOM_LAB_WARNING,
            labEntries: [{ id: "lab-1", name: "Lipid panel", note: null }],
          },
        ]}
      />,
    );

    expect(screen.getByText(CUSTOM_LAB_WARNING)).toBeVisible();
    expect(screen.getByText("Clinician instruction")).toBeVisible();
    expect(screen.queryByText(/federal recommendation/i)).toBeVisible();
  });
});
