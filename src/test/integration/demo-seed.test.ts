import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const demoSuite =
  testDatabaseUrl !== undefined && process.env.DEMO_SEED_ENABLED === "true"
    ? describe
    : describe.skip;

const demoProfileIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
  "30000000-0000-4000-8000-000000000004",
];

demoSuite("idempotent synthetic demo seed", () => {
  let database: PrismaClient;

  beforeAll(async () => {
    const { createPrismaClient } = await import("@/server/db/client");
    database = createPrismaClient(testDatabaseUrl as string);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("keeps one active recommendation set and stable fixture totals after repeated seeding", async () => {
    const [profiles, recommendations, retired, events, documents, customMaintenance] =
      await Promise.all([
        database.profile.count({ where: { id: { in: demoProfileIds }, deletedAt: null } }),
        database.recommendationInstance.count({
          where: { profileId: { in: demoProfileIds }, retiredAt: null },
        }),
        database.recommendationInstance.count({
          where: { profileId: { in: demoProfileIds }, retiredAt: { not: null } },
        }),
        database.careEvent.count({ where: { profileId: { in: demoProfileIds } } }),
        database.document.count({ where: { profileId: { in: demoProfileIds }, deletedAt: null } }),
        database.customMaintenance.count({
          where: { profileId: { in: demoProfileIds }, status: "active" },
        }),
      ]);

    expect({ profiles, recommendations, retired, events, documents, customMaintenance }).toEqual({
      profiles: 4,
      recommendations: 224,
      retired: 0,
      events: 10,
      documents: 1,
      customMaintenance: 1,
    });
  });
});
