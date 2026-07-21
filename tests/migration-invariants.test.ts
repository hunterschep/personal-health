import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync(
  resolve("prisma/migrations/20260721000000_initial/migration.sql"),
  "utf8",
);
const correctiveMigration = readFileSync(
  resolve("prisma/migrations/20260721040000_guideline_baseline_variant_constraint/migration.sql"),
  "utf8",
);

describe("forward migration invariants", () => {
  it("replaces row-level baseline uniqueness with variant-level exclusion", () => {
    expect(initialMigration).toContain(
      'CREATE UNIQUE INDEX "GuidelineRule_active_conflict_baseline_key"',
    );
    expect(correctiveMigration).toContain(
      'DROP INDEX "GuidelineRule_active_conflict_baseline_key"',
    );
    expect(correctiveMigration).toMatch(
      /EXCLUDE USING gist \(\s*"conflictGroup" WITH =,\s*"variantId" WITH <>\s*\)/,
    );
  });

  it("migrates calculation arrays before enforcing the current JSON shapes", () => {
    const dropAt = correctiveMigration.indexOf(
      'DROP CONSTRAINT "RecommendationInstance_explanation_array"',
    );
    const updateAt = correctiveMigration.indexOf('UPDATE "RecommendationInstance"');
    const addAt = correctiveMigration.indexOf(
      'ADD CONSTRAINT "RecommendationInstance_explanation_shapes"',
    );

    expect(dropAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(dropAt);
    expect(addAt).toBeGreaterThan(updateAt);
    expect(correctiveMigration).toContain(`jsonb_typeof("explanationJson") = 'object'`);
    expect(correctiveMigration).toContain(`jsonb_typeof("matchingFactsJson") = 'array'`);
  });

  it("trims legacy fixed-width hashes while moving to a variable-width column", () => {
    expect(initialMigration).toContain('"calculationHash" CHAR(64) NOT NULL');
    expect(correctiveMigration).toMatch(
      /ALTER COLUMN "calculationHash" TYPE VARCHAR\(64\)\s+USING rtrim\("calculationHash"\)/,
    );
  });
});
