# Part 05 — Rule DSL, validation, authoring helpers, and version governance

## Scope completed

- Added serializable authoring helpers for every expression composition pattern and schedule family used by the reviewed catalog.
- Added Zod plus semantic validation for age bounds, allowlisted risk paths, method sets, dose ordinals, effective dates, active scenarios, and scheduled/allowed method coherence.
- Added rule-set validation for active conflict-group baselines and overlapping active versions.
- Added immutable-active-version enforcement, version cloning, seed validation, database drift checks, and semantic version-to-version rule comparison.

## Files added or changed

- `src/domain/rules/authoring.ts`
- `src/domain/rules/authoring.test.ts`
- `src/contracts/rules.ts` as the frozen schema consumed by authoring
- `scripts/validate-rules.ts` and `scripts/diff-rules.ts`
- `prisma/seed/rules.ts` validation and persistence adapters

## Public contracts introduced

- `validateRuleDefinition`, `validateRuleSet`, `defineRule`, `assertRuleMayBeMutated`, and `cloneRuleVersion`
- `DEFAULT_ALLOWED_RISK_PATHS` and structured `RuleValidationIssue` results
- Expression helpers such as `all`, `any`, `not`, `ageBetween`, `anatomyIs`, `riskEquals`, and `riskNumber`
- Age, interval, method-dependent, one-time, seasonal, dose-series, shared-decision, and custom schedule helpers
- `rules:validate` and `rules:diff` operator commands
- Semantic diff reports for eligibility, schedule, source, explanation, affected scenarios, conservative profile estimates, and rebuild classification

## Database changes

None. Part 05 uses the Part 02 `GuidelineRule` version, review, effective-date, variant, baseline, and source/service fields.

## Tests added

- Rejection of invalid dates, unsafe risk paths, duplicate methods, nonconsecutive doses, incoherent baselines, overlapping active versions, and active-rule mutation
- Version cloning and valid helper output
- Rule-diff argument validation, canonical semantic comparison, filtering, scenario impact, profile estimates, and activation-aware rebuild classification

## Commands run

```text
pnpm exec vitest run src/domain/rules/authoring.test.ts
pnpm exec vitest run tests/rule-diff.test.ts
pnpm rules:validate --json
```

Results: 7 authoring tests and 10 semantic-diff tests passed. Catalog validation passed for 60 services, 77 methods, 63 active rules, 4 conflict groups, and 34 referenced sources.

## Known integration considerations

- Active versions are treated as immutable in application helpers and database identity constraints; changes should be cloned, reviewed, seeded, diffed, and activated as a new version.
- The DSL stays JSON-serializable. It does not execute authored JavaScript or fetch external source text.
- Conflict groups may contain multiple non-overlapping rows for one baseline variant; validation counts baseline variants, not rows.

## Remaining limitations

- Authoring is a maintainer code-and-review workflow; there is no in-app rule editor or approval UI.
- Profile-impact estimates use a conservative jurisdiction-level candidate set rather than evaluating private health facts inside the maintenance command.

## No-core-TODO confirmation

No core Part 05 TODO, mutable-active-rule path, unvalidated executable rule payload, or placeholder governance command remains.
