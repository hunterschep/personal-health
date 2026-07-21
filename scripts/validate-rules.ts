import { GUIDELINE_RULE_SEEDS, validateGuidelineRuleSeeds } from "../prisma/seed/rules";
import { SERVICE_METHOD_SEED_RECORDS, SERVICE_SEED_RECORDS } from "../prisma/seed/catalog";

function main(): void {
  const json = process.argv.slice(2).includes("--json");
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--json");
  if (unknown.length > 0) throw new TypeError(`Unknown argument: ${unknown[0]}`);

  const issues = validateGuidelineRuleSeeds();
  const conflictGroups = new Set(
    GUIDELINE_RULE_SEEDS.map((rule) => rule.conflictGroup).filter(
      (group): group is string => group !== null,
    ),
  );
  const sourceSlugs = new Set(GUIDELINE_RULE_SEEDS.map((rule) => rule.sourceSlug));
  const report = {
    ok: issues.length === 0,
    services: SERVICE_SEED_RECORDS.length,
    methods: SERVICE_METHOD_SEED_RECORDS.length,
    rules: GUIDELINE_RULE_SEEDS.length,
    activeRules: GUIDELINE_RULE_SEEDS.filter((rule) => rule.reviewStatus === "active").length,
    conflictGroups: conflictGroups.size,
    referencedSources: sourceSlugs.size,
    issues,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `CareCadence reviewed rule validation: ${report.ok ? "PASS" : "FAIL"}`,
        `${report.services} services; ${report.methods} methods; ${report.rules} rules`,
        `${report.referencedSources} sources; ${report.conflictGroups} conflict groups`,
        ...issues.map((issue) => `ERROR ${issue.path}: ${issue.message}`),
      ].join("\n") + "\n",
    );
  }
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown rule validation failure.";
  process.stderr.write(`Rule validation failed: ${message}\n`);
  process.exitCode = 1;
}
