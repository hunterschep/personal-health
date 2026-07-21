import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/server/db/transactions";

import {
  createCustomMaintenance,
  customMaintenanceInputSchema,
  customMaintenanceTimingState,
  customMaintenanceVisibilityWhere,
  CUSTOM_LAB_WARNING,
  CUSTOM_MAINTENANCE_SOURCE_LABELS,
  isProfileOwnerOrOrganizer,
  maintenanceTemplateAdoptionSchema,
  serializeCustomMaintenance,
} from "./service";

const validRoutineInput = {
  title: "Primary care check-in",
  category: "Primary care",
  source: "personal" as const,
  kind: "routine" as const,
  reminderEnabled: false,
};

describe("custom maintenance validation", () => {
  it("normalizes an optional personal cadence without inventing a schedule", () => {
    const result = customMaintenanceInputSchema.parse(validRoutineInput);

    expect(result).toMatchObject({
      cadenceValue: null,
      cadenceUnit: null,
      nextDate: null,
      reminderEnabled: false,
      reminderDaysBefore: null,
      visibility: "profile_access",
    });
  });

  it("requires individual entries and rejects duplicate lab names", () => {
    const result = customMaintenanceInputSchema.safeParse({
      ...validRoutineInput,
      title: "Clinician labs",
      category: "Labs",
      source: "clinician",
      kind: "lab_bundle",
      labEntries: [{ name: "Lipid panel" }, { name: "lipid PANEL" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(({ path }) => path.join(".") === "labEntries.1.name")).toBe(
        true,
      );
    }
  });

  it("does not accept an app template as the asserted source of a free-form item", () => {
    expect(
      customMaintenanceInputSchema.safeParse({
        ...validRoutineInput,
        source: "app_template",
      }).success,
    ).toBe(false);
  });

  it("requires a cadence for template adoption only when cadence is chosen", () => {
    expect(
      maintenanceTemplateAdoptionSchema.safeParse({ choice: "cadence", reminderEnabled: false })
        .success,
    ).toBe(false);
    expect(
      maintenanceTemplateAdoptionSchema.safeParse({
        choice: "ask_clinician",
        reminderEnabled: false,
      }).success,
    ).toBe(true);
    expect(
      maintenanceTemplateAdoptionSchema.safeParse({ choice: "disabled", reminderEnabled: false })
        .success,
    ).toBe(true);
  });

  it("rejects contradictory date ranges and unrealistic cadence values", () => {
    const result = customMaintenanceInputSchema.safeParse({
      ...validRoutineInput,
      cadenceValue: 101,
      cadenceUnit: "years",
      startDate: "2027-01-01",
      nextDate: "2026-12-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        cadenceValue: [expect.any(String)],
        nextDate: [expect.any(String)],
      });
    }
  });
});

describe("custom maintenance presentation", () => {
  it("never labels a custom source as a federal recommendation", () => {
    expect(Object.values(CUSTOM_MAINTENANCE_SOURCE_LABELS)).toEqual([
      "Personal reminder",
      "Clinician instruction",
      "Health-maintenance cadence",
    ]);
    expect(Object.values(CUSTOM_MAINTENANCE_SOURCE_LABELS).join(" ").toLowerCase()).not.toContain(
      "federal",
    );
  });

  it("does not produce a timing-review state until a cadence is selected", () => {
    const noCadence = customMaintenanceTimingState(
      {
        status: "ask_clinician",
        cadenceValue: null,
        cadenceUnit: null,
        nextDate: "2020-01-01",
      },
      new Date("2026-07-21T00:00:00.000Z"),
    );
    const selectedCadence = customMaintenanceTimingState(
      {
        status: "active",
        cadenceValue: 1,
        cadenceUnit: "years",
        nextDate: "2020-01-01",
      },
      new Date("2026-07-21T00:00:00.000Z"),
    );

    expect(noCadence).toBe("cadence_needed");
    expect(selectedCadence).toBe("timing_review");
  });

  it("always adds the personal-plan warning to a lab bundle response", () => {
    const result = serializeCustomMaintenance({
      id: "maintenance-1",
      templateServiceId: null,
      title: "My labs",
      category: "Labs",
      purpose: null,
      kind: "lab_bundle",
      source: "clinician",
      clinicianName: "Dr. Rivera",
      practiceName: null,
      cadenceValue: 6,
      cadenceUnit: "months",
      startDate: null,
      stopDate: null,
      nextDate: null,
      reminderEnabled: false,
      reminderDaysBefore: null,
      visibility: "owner_only",
      notes: null,
      status: "active",
      labEntries: [{ id: "lab-1", name: "Lipid panel", note: null, sortOrder: 0 }],
    });

    expect(result.warning).toBe(CUSTOM_LAB_WARNING);
    expect(result.sourceLabel).toBe("Clinician instruction");
  });
});

describe("custom maintenance authorization and audit", () => {
  it("limits owner-only items at every shared read boundary", () => {
    expect(customMaintenanceVisibilityWhere(false)).toEqual({ visibility: "profile_access" });
    expect(customMaintenanceVisibilityWhere(true)).toEqual({});
  });

  it("recognizes only the owner or organizer of an unclaimed profile", () => {
    const base = {
      ownerUserId: null,
      createdByUserId: "creator",
      claimedAt: null,
      household: { members: [{ userId: "owner", role: "owner" as const }] },
    };

    expect(isProfileOwnerOrOrganizer(base, "creator")).toBe(true);
    expect(isProfileOwnerOrOrganizer(base, "owner")).toBe(true);
    expect(isProfileOwnerOrOrganizer(base, "viewer")).toBe(false);
    expect(
      isProfileOwnerOrOrganizer(
        { ...base, ownerUserId: "claimed-owner", claimedAt: new Date("2026-01-01") },
        "creator",
      ),
    ).toBe(false);
  });

  it("creates a value-free audit entry with the mutation", async () => {
    const createAudit = vi.fn(async () => ({ id: "audit-1" }));
    const createRecord = vi.fn(async () => ({
      id: "maintenance-1",
      profileId: "profile-1",
      templateServiceId: null,
      title: "Primary care check-in",
      category: "Primary care",
      purpose: null,
      kind: "routine" as const,
      source: "personal" as const,
      clinicianName: null,
      practiceName: null,
      cadenceValue: null,
      cadenceUnit: null,
      startDate: null,
      stopDate: null,
      nextDate: null,
      reminderEnabled: false,
      reminderDaysBefore: null,
      visibility: "profile_access" as const,
      notes: null,
      status: "active" as const,
      disabledAt: null,
      createdByUserId: "user-1",
      createdAt: new Date("2026-07-21"),
      updatedAt: new Date("2026-07-21"),
      labEntries: [],
    }));
    const database = {
      customMaintenance: { create: createRecord },
      auditLog: { create: createAudit },
    } as unknown as DatabaseClient;

    await createCustomMaintenance(
      {
        database,
        profileId: "profile-1",
        householdId: "household-1",
        actorUserId: "user-1",
        canAccessOwnerOnly: true,
      },
      customMaintenanceInputSchema.parse(validRoutineInput),
    );

    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "custom_maintenance.created",
        entityId: "maintenance-1",
        metadataJson: { labEntryCount: 0 },
      }),
    });
    expect(JSON.stringify(createAudit.mock.calls)).not.toContain("Primary care check-in");
  });

  it("rejects owner-only creation before touching storage for a non-owner editor", async () => {
    const createRecord = vi.fn();
    const database = {
      customMaintenance: { create: createRecord },
      auditLog: { create: vi.fn() },
    } as unknown as DatabaseClient;
    const input = customMaintenanceInputSchema.parse({
      ...validRoutineInput,
      visibility: "owner_only",
    });

    await expect(
      createCustomMaintenance(
        {
          database,
          profileId: "profile-1",
          householdId: "household-1",
          actorUserId: "editor-1",
          canAccessOwnerOnly: false,
        },
        input,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(createRecord).not.toHaveBeenCalled();
  });
});
