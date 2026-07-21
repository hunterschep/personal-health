import { pathToFileURL } from "node:url";

import { createPrismaClient } from "@/server/db";
import {
  parseRebuildCliOptions,
  rebuildProfileWhere,
  REBUILD_CLI_HELP,
} from "@/server/recommendations/cli";
import {
  rebuildProfileRecommendations,
  type RecommendationRebuildReason,
} from "@/server/recommendations";

let database: ReturnType<typeof createPrismaClient> | null = null;

async function affectedJurisdictions(
  activeDatabase: ReturnType<typeof createPrismaClient>,
  options: ReturnType<typeof parseRebuildCliOptions>,
): Promise<string[]> {
  if (options.ruleStableKey === null && options.rulesChangedSince === null) return [];
  const rules = await activeDatabase.guidelineRule.findMany({
    where: {
      ...(options.ruleStableKey === null ? {} : { stableKey: options.ruleStableKey }),
      ...(options.rulesChangedSince === null
        ? {}
        : { updatedAt: { gte: new Date(`${options.rulesChangedSince}T00:00:00.000Z`) } }),
    },
    distinct: ["jurisdiction"],
    select: { jurisdiction: true },
  });
  return [...new Set(rules.map(({ jurisdiction }) => jurisdiction))].sort();
}

function rebuildReason(
  options: ReturnType<typeof parseRebuildCliOptions>,
): RecommendationRebuildReason {
  if (options.ruleStableKey !== null || options.rulesChangedSince !== null) {
    return "rule_version_activated";
  }
  if (options.profileId !== null || options.householdId !== null) return "manual_rebuild";
  return "daily_maintenance";
}

export async function runRecommendationRebuild(arguments_: readonly string[]): Promise<void> {
  const options = parseRebuildCliOptions(arguments_);
  if (options.help) {
    process.stdout.write(REBUILD_CLI_HELP);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error("DATABASE_URL is required.");
  }

  const activeDatabase = createPrismaClient(databaseUrl);
  database = activeDatabase;
  const jurisdictions = await affectedJurisdictions(activeDatabase, options);
  if (
    jurisdictions.length === 0 &&
    (options.ruleStableKey !== null || options.rulesChangedSince !== null)
  ) {
    process.stdout.write("No reviewed rule versions matched; 0 profiles rebuilt.\n");
    return;
  }

  let cursor = options.afterProfileId;
  let processed = 0;
  let profilesWithChanges = 0;
  let classifiedChanges = 0;
  const reason = rebuildReason(options);

  while (true) {
    const pageOptions = { ...options, afterProfileId: cursor };
    const profiles = await activeDatabase.profile.findMany({
      where: rebuildProfileWhere(pageOptions, jurisdictions),
      select: { id: true },
      orderBy: { id: "asc" },
      take: options.batchSize,
    });
    if (profiles.length === 0) break;

    for (const { id } of profiles) {
      const input = {
        profileId: id,
        actorUserId: null,
        reason,
        dryRun: options.dryRun,
        ...(options.asOfDate === null ? {} : { asOfDate: options.asOfDate }),
      } as const;
      const result = options.dryRun
        ? await rebuildProfileRecommendations(input, activeDatabase)
        : await activeDatabase.$transaction((transaction) =>
            rebuildProfileRecommendations(input, transaction),
          );
      processed += 1;
      classifiedChanges += result.changes.length;
      if (result.changes.length > 0) profilesWithChanges += 1;
      cursor = id;
    }

    process.stdout.write(
      `Completed batch: ${profiles.length} profiles; resume cursor ${cursor ?? "none"}.\n`,
    );
    if (profiles.length < options.batchSize) break;
  }

  process.stdout.write(
    `${options.dryRun ? "Dry run evaluated" : "Rebuilt"} ${processed} profiles; ${profilesWithChanges} had visible changes; ${classifiedChanges} changes classified.\n`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  void runRecommendationRebuild(process.argv.slice(2))
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown recommendation rebuild failure.";
      process.stderr.write(`Recommendation rebuild failed: ${message}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await database?.$disconnect();
    });
}
