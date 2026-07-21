import "dotenv/config";

import { createPrismaClient } from "@/server/db";

import { seedServiceCatalog } from "./catalog";
import { seedGuidelineRules } from "./rules";
import { seedSources } from "./sources";

let database: ReturnType<typeof createPrismaClient> | null = null;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required to seed CareCadence.");
  }

  const activeDatabase = createPrismaClient(databaseUrl);
  database = activeDatabase;
  const sourceCount = await activeDatabase.$transaction(seedSources);
  const catalogCount = await activeDatabase.$transaction(seedServiceCatalog);
  const ruleCount = await activeDatabase.$transaction(seedGuidelineRules);
  const demoEnabled = process.env.DEMO_SEED_ENABLED === "true";
  // The demo also writes a synthetic PDF through the configured private-storage
  // adapter, so keep the idempotent seed outside a long database transaction.
  const demoCount = demoEnabled
    ? await import("./demo").then(({ seedDemo }) => seedDemo(activeDatabase))
    : null;

  process.stdout.write(
    `Seed complete: ${sourceCount} sources, ${catalogCount.services} services, ${catalogCount.methods} methods, ${ruleCount} rules${
      demoCount === null
        ? ""
        : `, ${demoCount.users} demo users, ${demoCount.profiles} demo profiles`
    }.\n`,
  );
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown seed failure.";
    process.stderr.write(`Seed failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database?.$disconnect();
  });
