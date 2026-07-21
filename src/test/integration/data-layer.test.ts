import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseFactory } from "../factories/database";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = testDatabaseUrl === undefined ? describe.skip : describe;

databaseSuite("data-layer integration", () => {
  const factory = createDatabaseFactory(902);
  let database: PrismaClient;

  async function cleanFixture(): Promise<void> {
    await database.auditLog.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.reminder.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.customMaintenance.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.medication.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.recommendationInstance.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.clinicianOverride.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.careEvent.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.guidelineRule.deleteMany({ where: { id: factory.ids.rule } });
    await database.guidelineSource.deleteMany({ where: { id: factory.ids.source } });
    await database.serviceMethod.deleteMany({ where: { serviceId: factory.ids.service } });
    await database.serviceCatalog.deleteMany({ where: { id: factory.ids.service } });
    await database.profile.deleteMany({ where: { id: factory.ids.profile } });
    await database.householdMember.deleteMany({ where: { householdId: factory.ids.household } });
    await database.household.deleteMany({ where: { id: factory.ids.household } });
    await database.user.deleteMany({ where: { id: factory.ids.user } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.AUTH_SECRET = "integration-test-secret-with-at-least-thirty-two-characters";
    const { createPrismaClient } = await import("@/server/db/client");
    database = createPrismaClient(testDatabaseUrl as string);
    await cleanFixture();
    await database.user.create({ data: factory.user() });
    await database.household.create({ data: factory.household() });
    await database.householdMember.create({ data: factory.householdMember() });
    await database.profile.create({ data: factory.profile() });
    await database.serviceCatalog.create({ data: factory.service() });
    await database.serviceMethod.create({ data: factory.serviceMethod() });
    await database.guidelineSource.create({ data: factory.guidelineSource() });
    await database.guidelineRule.create({ data: factory.guidelineRule() });
  });

  afterAll(async () => {
    await cleanFixture();
    await database.$disconnect();
  });

  it("rejects care-event ranges whose start is after the end", async () => {
    await expect(
      database.careEvent.create({
        data: factory.careEvent({
          performedStart: new Date("2025-12-31T00:00:00.000Z"),
          performedEnd: new Date("2025-01-01T00:00:00.000Z"),
          datePrecision: "year",
        }),
      }),
    ).rejects.toThrow();
  });

  it("rolls back a care event when recommendation rebuilding fails", async () => {
    const { recordCareEventAndRebuild } = await import("@/server/db/workflows");
    const before = await database.careEvent.count({ where: { profileId: factory.ids.profile } });

    await expect(
      recordCareEventAndRebuild(
        {
          profileId: factory.ids.profile,
          serviceId: factory.ids.service,
          methodId: factory.ids.method,
          performedStart: new Date("2025-07-21T00:00:00.000Z"),
          performedEnd: new Date("2025-07-21T00:00:00.000Z"),
          datePrecision: "day",
          result: "normal",
          providerName: "Synthetic Clinic",
          locationName: null,
          notes: null,
          source: "medical_record",
          importBatchId: null,
          createdByUserId: factory.ids.user,
        },
        async () => {
          throw new Error("Synthetic rebuild failure");
        },
      ),
    ).rejects.toThrow("Synthetic rebuild failure");

    await expect(
      database.careEvent.count({ where: { profileId: factory.ids.profile } }),
    ).resolves.toBe(before);
  });

  it("keeps an identical short-hash recommendation snapshot unchanged", async () => {
    const snapshot = factory.recommendation();
    await database.recommendationInstance.create({ data: snapshot });
    const { createRecommendationRepository } = await import("@/server/repositories/recommendation");

    const result = await createRecommendationRepository(database).synchronizeActiveSnapshots(
      factory.ids.profile,
      [snapshot],
      new Date("2026-07-21T13:00:00.000Z"),
    );
    const stored = await database.recommendationInstance.findMany({
      where: { profileId: factory.ids.profile },
      select: { calculationHash: true, retiredAt: true },
    });

    expect(result).toEqual({
      createdIds: [],
      unchangedIds: [factory.ids.recommendation],
      retiredIds: [],
    });
    expect(stored).toEqual([{ calculationHash: "fnv1a-deadbeef", retiredAt: null }]);
  });

  it("authorizes, classifies, audits, previews, and idempotently rebuilds a profile plan", async () => {
    const { rebuildProfileRecommendations } = await import("@/server/recommendations");
    await database.recommendationInstance.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.auditLog.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.careEvent.deleteMany({ where: { profileId: factory.ids.profile } });
    await database.profile.update({
      where: { id: factory.ids.profile },
      data: { visibility: "owner_only", displayName: "Synthetic Adult" },
    });

    const first = await database.$transaction((transaction) =>
      rebuildProfileRecommendations(
        {
          profileId: factory.ids.profile,
          actorUserId: factory.ids.user,
          asOfDate: "2026-07-21",
          reason: "profile_created",
        },
        transaction,
      ),
    );
    expect(first.persisted).toBe(true);
    expect(first.changes.map(({ type }) => type)).toContain("newly_applicable");
    expect(first.createdIds.length).toBeGreaterThan(0);
    await expect(
      database.auditLog.count({
        where: { profileId: factory.ids.profile, action: "recommendations.rebuilt" },
      }),
    ).resolves.toBe(1);
    await expect(
      database.auditLog.count({
        where: { profileId: factory.ids.profile, action: "care_plan.changed" },
      }),
    ).resolves.toBe(0);

    await database.profile.update({
      where: { id: factory.ids.profile },
      data: { displayName: "A display-only change" },
    });
    const unchanged = await rebuildProfileRecommendations(
      {
        profileId: factory.ids.profile,
        actorUserId: factory.ids.user,
        asOfDate: "2026-07-21",
        reason: "profile_edited",
      },
      database,
    );
    expect(unchanged.changes).toEqual([]);
    expect(unchanged.unchangedIds).toEqual(first.createdIds);

    await database.careEvent.create({ data: factory.careEvent() });
    const beforePreview = await database.recommendationInstance.count({
      where: { profileId: factory.ids.profile },
    });
    const preview = await rebuildProfileRecommendations(
      {
        profileId: factory.ids.profile,
        actorUserId: factory.ids.user,
        asOfDate: "2026-07-21",
        reason: "care_event_created",
        dryRun: true,
      },
      database,
    );
    expect(preview.persisted).toBe(false);
    expect(preview.changes.map(({ type }) => type)).toContain("status_changed");
    await expect(
      database.recommendationInstance.count({ where: { profileId: factory.ids.profile } }),
    ).resolves.toBe(beforePreview);

    await database.profile.update({
      where: { id: factory.ids.profile },
      data: { visibility: "household" },
    });
    await database.$transaction((transaction) =>
      rebuildProfileRecommendations(
        {
          profileId: factory.ids.profile,
          actorUserId: factory.ids.user,
          asOfDate: "2026-07-21",
          reason: "care_event_created",
        },
        transaction,
      ),
    );
    await expect(
      database.auditLog.count({
        where: { profileId: factory.ids.profile, action: "care_plan.changed" },
      }),
    ).resolves.toBe(1);
  });

  it("deduplicates personal reminders, preserves snooze, and replaces stale schedules", async () => {
    await database.recommendationInstance.deleteMany({ where: { profileId: factory.ids.profile } });
    const maintenance = await database.customMaintenance.create({
      data: {
        profileId: factory.ids.profile,
        title: "Synthetic personal cadence",
        category: "Synthetic category",
        kind: "routine",
        source: "personal",
        nextDate: new Date("2026-08-15T00:00:00.000Z"),
        reminderEnabled: true,
        reminderDaysBefore: 14,
        visibility: "profile_access",
        status: "active",
        createdByUserId: factory.ids.user,
      },
    });
    await database.medication.create({
      data: factory.medication({ nextReviewDate: new Date("2026-09-01T00:00:00.000Z") }),
    });
    await database.clinicianOverride.create({
      data: factory.clinicianOverride({ reviewDate: new Date("2026-10-15T00:00:00.000Z") }),
    });
    const { generateRemindersForProfile } = await import("@/server/reminders/generate");
    const now = new Date("2026-07-21T12:00:00.000Z");

    await expect(generateRemindersForProfile(factory.ids.profile, now, database)).resolves.toEqual({
      candidateCount: 3,
      createdCount: 3,
    });
    await expect(generateRemindersForProfile(factory.ids.profile, now, database)).resolves.toEqual({
      candidateCount: 3,
      createdCount: 0,
    });

    const maintenanceReminder = await database.reminder.findFirstOrThrow({
      where: {
        profileId: factory.ids.profile,
        dedupeKey: { startsWith: `custom-maintenance:${maintenance.id}:` },
      },
    });
    const snoozeUntil = new Date("2026-08-10T16:00:00.000Z");
    await database.reminder.update({
      where: { id: maintenanceReminder.id },
      data: { remindAt: snoozeUntil },
    });
    await generateRemindersForProfile(factory.ids.profile, now, database);
    await expect(
      database.reminder.findUniqueOrThrow({ where: { id: maintenanceReminder.id } }),
    ).resolves.toMatchObject({ remindAt: snoozeUntil, status: "pending" });

    await database.customMaintenance.update({
      where: { id: maintenance.id },
      data: { nextDate: new Date("2026-08-22T00:00:00.000Z") },
    });
    await expect(generateRemindersForProfile(factory.ids.profile, now, database)).resolves.toEqual({
      candidateCount: 3,
      createdCount: 1,
    });
    const reminders = await database.reminder.findMany({
      where: { profileId: factory.ids.profile },
      orderBy: { dedupeKey: "asc" },
    });
    expect(reminders).toHaveLength(3);
    expect(reminders.map(({ dedupeKey }) => dedupeKey)).toContain(
      `custom-maintenance:${maintenance.id}:2026-08-22:days-before:14`,
    );
  });
});
