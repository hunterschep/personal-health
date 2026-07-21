import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { SOURCE_REGISTRY } from "../src/server/sources/registry";
import {
  formatVerificationReport,
  verifyLiveSourceUrls,
  verifySourceStructure,
} from "../src/server/sources/verification";
import type { GuidelineRuleSourceReference } from "../src/server/sources/types";

const ruleReferenceSchema = z
  .object({
    stableKey: z.string(),
    version: z.number().int().positive(),
    variantId: z.string().optional(),
    sourceSlug: z.string(),
    reviewStatus: z.enum(["draft", "reviewed", "active", "retired"]),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable(),
    conflictGroup: z.string().nullable(),
    baseline: z.boolean().default(false),
    importsSourceText: z.boolean().default(false),
  })
  .passthrough();

type CliOptions = {
  live: boolean;
  json: boolean;
  asOfDate: string;
  rulesPath: string | null;
};

function parseArguments(arguments_: string[]): CliOptions {
  let live = false;
  let json = false;
  let asOfDate = new Date().toISOString().slice(0, 10);
  let rulesPath: string | null = null;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--live") live = true;
    else if (argument === "--json") json = true;
    else if (argument === "--as-of") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new TypeError("--as-of requires YYYY-MM-DD.");
      asOfDate = value;
      index += 1;
    } else if (argument === "--rules") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new TypeError("--rules requires a module or JSON path.");
      rulesPath = path.resolve(value);
      index += 1;
    } else {
      throw new TypeError(`Unknown argument: ${argument}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new TypeError("--as-of requires YYYY-MM-DD.");
  }
  return { live, json, asOfDate, rulesPath };
}

function findRuleArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value !== "object") return null;
  for (const key of ["GUIDELINE_RULES", "RULE_DEFINITIONS", "guidelineRules", "rules", "default"]) {
    const candidate = Reflect.get(value, key);
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function normalizeRules(value: unknown): GuidelineRuleSourceReference[] {
  const array = findRuleArray(value);
  if (array === null) return [];
  return array.map((rule) => ruleReferenceSchema.parse(rule));
}

async function loadRuleFile(filePath: string): Promise<GuidelineRuleSourceReference[]> {
  if (filePath.endsWith(".json")) {
    return normalizeRules(JSON.parse(await readFile(filePath, "utf8")) as unknown);
  }
  const loaded = (await import(pathToFileURL(filePath).href)) as unknown;
  return normalizeRules(loaded);
}

async function discoverRules(explicitPath: string | null): Promise<GuidelineRuleSourceReference[]> {
  if (explicitPath !== null) return loadRuleFile(explicitPath);

  for (const candidate of [
    path.resolve("prisma/seed/rules.ts"),
    path.resolve("src/domain/rules/catalog.ts"),
  ]) {
    try {
      await access(candidate);
      const rules = await loadRuleFile(candidate);
      if (rules.length > 0) return rules;
    } catch {
      // Optional discovery only. Explicit --rules failures are not swallowed.
    }
  }
  return [];
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const rules = await discoverRules(options.rulesPath);
  let report = verifySourceStructure({
    sources: SOURCE_REGISTRY,
    rules,
    asOfDate: options.asOfDate,
  });
  if (options.live) report = await verifyLiveSourceUrls(report, SOURCE_REGISTRY);

  process.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatVerificationReport(report)}\n`,
  );
  if (!report.ok) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown source verification failure.";
  process.stderr.write(`Source verification failed: ${message}\n`);
  process.exitCode = 1;
});
