import { lstat, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { parseCsv } from "@/server/imports/csv";
import { resolveImportRows } from "@/server/imports/resolve";
import { CSV_HEADERS, MAX_CSV_ROWS } from "@/server/imports/types";
import { accessibleProfileWhere } from "@/server/authorization/profile-query";
import { rebuildProfileRecommendations } from "@/server/recommendations/rebuild";

type Measurement = {
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  sqlStatements: number;
};

type BundleMeasurement = {
  standaloneBytes: number;
  staticBytes: number;
  browserJavaScriptBytes: number;
  serverAppBytes: number;
};

type BenchmarkReport = {
  generatedAt: string;
  runtime: {
    node: string;
    platform: string;
    cpu: string;
    logicalCpus: number;
    memoryBytes: number;
    iterations: number;
  };
  bundle: BundleMeasurement;
  overviewReadModel: Measurement;
  familyReadModel: Measurement;
  dryRunRecommendationRebuild: Measurement;
  maxRowCsvPreview: Measurement & { rows: number };
};

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function milliseconds(value: number): number {
  return Number(value.toFixed(2));
}

async function directoryBytes(
  root: string,
  include: (filePath: string) => boolean = () => true,
): Promise<number> {
  const rootStat = await stat(root).catch(() => null);
  if (rootStat === null) {
    throw new Error(`Missing ${root}. Run pnpm build before the release benchmark.`);
  }
  if (rootStat.isFile()) return include(root) ? rootStat.size : 0;

  const entries = await readdir(root, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isSymbolicLink()) {
        return lstat(entryPath).then((metadata) => (include(entryPath) ? metadata.size : 0));
      }
      return entry.isDirectory()
        ? directoryBytes(entryPath, include)
        : stat(entryPath).then((metadata) => (include(entryPath) ? metadata.size : 0));
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

async function measureBundle(): Promise<BundleMeasurement> {
  return {
    standaloneBytes: await directoryBytes(".next/standalone"),
    staticBytes: await directoryBytes(".next/static"),
    browserJavaScriptBytes: await directoryBytes(".next/static/chunks", (filePath) =>
      filePath.endsWith(".js"),
    ),
    serverAppBytes: await directoryBytes(".next/server/app"),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required for the release benchmark.");
  }
  const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? "7");
  if (!Number.isInteger(iterations) || iterations < 3 || iterations > 50) {
    throw new Error("BENCHMARK_ITERATIONS must be an integer from 3 through 50.");
  }
  const asOfDate = process.env.BENCHMARK_AS_OF ?? new Date().toISOString().slice(0, 10);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    application_name: "carecadence-release-benchmark",
    max: 8,
  });
  let queryCount = 0;
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, thisArgument, argumentsList) {
        queryCount += 1;
        return Reflect.apply(target, thisArgument, argumentsList);
      },
    });
  });
  const database = new PrismaClient({ adapter: new PrismaPg(pool) });

  async function measure(operation: () => Promise<void>): Promise<Measurement> {
    await operation();
    const durations: number[] = [];
    const statementCounts: number[] = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      queryCount = 0;
      const startedAt = performance.now();
      await operation();
      durations.push(performance.now() - startedAt);
      statementCounts.push(queryCount);
    }
    return {
      medianMs: milliseconds(percentile(durations, 0.5)),
      p95Ms: milliseconds(percentile(durations, 0.95)),
      minMs: milliseconds(Math.min(...durations)),
      maxMs: milliseconds(Math.max(...durations)),
      sqlStatements: Math.max(...statementCounts),
    };
  }

  try {
    const benchmarkUser = await database.user.findFirst({
      where: {
        deletedAt: null,
        emailNormalized: process.env.DEMO_USER_EMAIL ?? "demo@carecadence.local",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (benchmarkUser === null) {
      throw new Error("Seed a synthetic household before running the release benchmark.");
    }
    const benchmarkProfile = await database.profile.findFirst({
      where: accessibleProfileWhere(benchmarkUser.id),
      orderBy: [{ createdAt: "asc" }, { displayName: "asc" }],
      select: { id: true, householdId: true },
    });
    if (benchmarkProfile === null) {
      throw new Error("The benchmark user has no accessible synthetic profile.");
    }

    const loadAccessibleProfiles = () =>
      database.profile.findMany({
        where: accessibleProfileWhere(benchmarkUser.id),
        include: {
          recommendations: {
            where: { retiredAt: null },
            include: { service: true },
            orderBy: [{ dueStart: "asc" as const }, { service: { sortOrder: "asc" as const } }],
          },
          household: {
            include: {
              members: { where: { userId: benchmarkUser.id, removedAt: null }, take: 1 },
            },
          },
          accessGrants: { where: { userId: benchmarkUser.id }, take: 1 },
        },
        orderBy: [{ createdAt: "asc" as const }, { displayName: "asc" as const }],
      });

    const overviewReadModel = await measure(async () => {
      await loadAccessibleProfiles();
      await Promise.all([
        (async () => {
          await database.profile.findFirst({
            where: { id: benchmarkProfile.id, deletedAt: null },
            include: {
              household: {
                include: {
                  members: { where: { userId: benchmarkUser.id, removedAt: null }, take: 1 },
                },
              },
              accessGrants: { where: { userId: benchmarkUser.id }, take: 1 },
            },
          });
          await Promise.all([
            database.recommendationInstance.findMany({
              where: { profileId: benchmarkProfile.id, retiredAt: null },
              include: {
                service: true,
                rule: { include: { source: true } },
                lastQualifyingEvent: true,
                activeOverride: true,
                plannedActions: { where: { status: { in: ["planned", "scheduled"] } } },
                reminders: {
                  where: { status: "pending" },
                  orderBy: { remindAt: "asc" },
                  take: 1,
                },
              },
              orderBy: [{ dueStart: "asc" }, { service: { sortOrder: "asc" } }, { id: "asc" }],
            }),
            database.profileServiceHistoryState.findMany({
              where: { profileId: benchmarkProfile.id },
              select: { serviceId: true, state: true, reason: true },
            }),
          ]);
        })(),
        database.plannedAction.findMany({
          where: {
            profileId: benchmarkProfile.id,
            status: { in: ["planned", "scheduled"] },
          },
          orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }],
          take: 3,
        }),
      ]);
    });

    const familyReadModel = await measure(async () => {
      const visibleProfiles = await loadAccessibleProfiles();
      const membership = await database.householdMember.findFirst({
        where: {
          householdId: benchmarkProfile.householdId,
          userId: benchmarkUser.id,
          removedAt: null,
          household: { deletedAt: null },
        },
        include: { household: true },
      });
      if (membership === null) throw new Error("The benchmark membership was removed.");
      const profileIds = visibleProfiles
        .filter(({ householdId }) => householdId === membership.householdId)
        .map(({ id }) => id);
      const canManage = membership.role === "owner" || membership.role === "admin";
      await Promise.all([
        canManage
          ? database.householdInvite.count({
              where: {
                householdId: membership.householdId,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
            })
          : Promise.resolve(0),
        canManage
          ? database.profileClaimInvite.findMany({
              where: {
                profile: { householdId: membership.householdId, deletedAt: null },
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { profileId: true },
            })
          : Promise.resolve([]),
        database.reminderPreference.findMany({
          where: { profileId: { in: profileIds }, householdActivityDetail: true },
          select: { profileId: true, userId: true },
        }),
        database.auditLog.findMany({
          where: {
            householdId: membership.householdId,
            OR: [{ profileId: null }, { profileId: { in: profileIds } }],
            action: {
              in: [
                "care_event.created",
                "care_event.updated",
                "care_plan.changed",
                "guideline_rule.updated",
                "profile.created",
                "profile.sharing_updated",
                "profile.claimed",
                "household.invite_accepted",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);
    });

    const dryRunRecommendationRebuild = await measure(async () => {
      await rebuildProfileRecommendations(
        {
          profileId: benchmarkProfile.id,
          actorUserId: null,
          asOfDate,
          reason: "manual_rebuild",
          dryRun: true,
        },
        database,
      );
    });

    const csvLines = [CSV_HEADERS.join(",")];
    const date = new Date(`${asOfDate}T00:00:00.000Z`);
    for (let row = 0; row < MAX_CSV_ROWS; row += 1) {
      const performed = new Date(date);
      performed.setUTCDate(performed.getUTCDate() - row - 1);
      csvLines.push(
        `colorectal-cancer-screening,,${performed.toISOString().slice(0, 10)},day,normal,Synthetic Clinic ${row},,csv_import,Release benchmark row ${row}`,
      );
    }
    const csv = csvLines.join("\n");
    const maxRowCsvPreview = await measure(async () => {
      const rows = parseCsv(csv, asOfDate);
      const [services, existingEvents] = await Promise.all([
        database.serviceCatalog.findMany({
          where: { active: true },
          select: {
            id: true,
            slug: true,
            name: true,
            methods: {
              where: { active: true },
              select: { id: true, slug: true, name: true },
            },
          },
        }),
        database.careEvent.findMany({
          where: { profileId: benchmarkProfile.id, deletedAt: null },
          select: {
            id: true,
            serviceId: true,
            methodId: true,
            performedStart: true,
            performedEnd: true,
            providerName: true,
          },
        }),
      ]);
      const resolved = resolveImportRows(rows, services, existingEvents);
      if (resolved.length !== MAX_CSV_ROWS) {
        throw new Error(`Expected ${MAX_CSV_ROWS} preview rows, received ${resolved.length}.`);
      }
    });

    const cpus = os.cpus();
    const report: BenchmarkReport = {
      generatedAt: new Date().toISOString(),
      runtime: {
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        cpu: cpus[0]?.model ?? "unknown",
        logicalCpus: cpus.length,
        memoryBytes: os.totalmem(),
        iterations,
      },
      bundle: await measureBundle(),
      overviewReadModel,
      familyReadModel,
      dryRunRecommendationRebuild,
      maxRowCsvPreview: { ...maxRowCsvPreview, rows: MAX_CSV_ROWS },
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await database.$disconnect();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown benchmark failure.";
  process.stderr.write(`Release benchmark failed: ${message}\n`);
  process.exitCode = 1;
});
