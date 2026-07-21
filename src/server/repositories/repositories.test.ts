import { describe, expect, it } from "vitest";

import type { CareEventRecord } from "./care-event";
import { careEventFingerprint } from "./care-event";
import { normalizeEmail, normalizeNullableText } from "./normalize";
import {
  fromDatabaseRecommendationClass,
  toDatabaseRecommendationClass,
} from "./persistence-mapping";

const event: CareEventRecord = {
  profileId: "90000000-0000-4000-8000-000000000001",
  serviceId: "90000000-0000-4000-8000-000000000002",
  methodId: null,
  performedStart: new Date("2024-01-01T00:00:00.000Z"),
  performedEnd: new Date("2024-12-31T00:00:00.000Z"),
  datePrecision: "year",
  result: "normal",
  providerName: " Synthetic Clinic ",
  locationName: null,
  notes: null,
  source: "user_memory",
  importBatchId: null,
  createdByUserId: "90000000-0000-4000-8000-000000000003",
};

describe("repository normalization", () => {
  it("normalizes identity and optional text without inventing values", () => {
    expect(normalizeEmail("  SYNTHETIC@EXAMPLE.INVALID ")).toBe("synthetic@example.invalid");
    expect(normalizeNullableText("   ")).toBeNull();
  });

  it("creates a deterministic care-event duplicate fingerprint", () => {
    expect(careEventFingerprint(event)).toBe(careEventFingerprint({ ...event }));
    expect(careEventFingerprint({ ...event, methodId: event.profileId })).not.toBe(
      careEventFingerprint(event),
    );
  });

  it("maps frozen recommendation class literals at the persistence boundary", () => {
    expect(toDatabaseRecommendationClass("shared-decision")).toBe("shared_decision");
    expect(fromDatabaseRecommendationClass("custom_maintenance")).toBe("custom-maintenance");
  });
});
