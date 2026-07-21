# Part 06 — Service catalog and initial reviewed guideline rule set

## Scope completed

- Added 60 stable service records and 77 service-method records covering preventive screening, immunization, discussion, and disabled/custom maintenance families.
- Added 63 active, reviewed, source-backed U.S. adult rule definitions referencing 34 registered sources, with recommendation classes, applicability, exclusions, schedules, variants, source limits, reviewer metadata, and scenario IDs.
- Added four conflict groups with coherent baselines, future-effective HRSA cervical guidance, specialty alternatives, current CDC addenda, and explicit insufficient-evidence/not-recommended classifications.
- Added deterministic production-evaluator catalog fixtures for all active rules and every method-dependent method.
- Added stable positive, negative, boundary, historical-completion, uncertainty, and abnormal-history IDs for every active rule, plus variant-selection IDs wherever guidance conflicts.
- Added all 33 PLAN cancer examples as deterministic scenarios against the real colorectal, breast, cervical, prostate, and lung seed rules.
- Added a 90-scenario vaccine acceptance matrix covering every seeded adult vaccine across never, partial, completed, unknown-date, age-transition, relevant-condition, minimum-interval, approximate-year, and applicable current-season states.
- Treat ambiguous dose-series results, methods, or dates as history needing confirmation before accepting a series as complete.

## Files added or changed

- `prisma/seed/catalog.ts`
- `prisma/seed/rules.ts`
- `prisma/seed/sources.ts`
- `tests/rule-seeds.test.ts`
- `tests/support/rule-seed-scenarios.ts`
- `tests/rule-seed-scenarios.test.ts`
- `tests/rule-seed-cancer-acceptance.test.ts`
- `tests/rule-seed-vaccine-acceptance.test.ts`
- `tests/rule-seed-complete-matrix.test.ts`
- `src/domain/rules/schedule.ts`
- `docs/source-register.md`

## Public contracts introduced

- `SERVICE_SEED_RECORDS`, `SERVICE_METHOD_SEED_RECORDS`, and catalog seed functions
- `GUIDELINE_RULE_SEEDS`, `GUIDELINE_RULES`, validation/assertion helpers, and guideline seed functions
- `buildRuleSeedScenarios` as a test-only adapter from real seed metadata to production evaluator input
- `buildRuleSeedInput` as a deterministic test-only adapter for exercising a selected active seed at a chosen age and as-of date

## Database changes

No schema migration. Idempotent seed code populates `GuidelineSource`, `ServiceCatalog`, `ServiceMethod`, and immutable `GuidelineRule` rows, resolving method slugs to database IDs at persistence time.

## Tests added

- Catalog uniqueness, required services/methods, source resolution, source freshness, conflict baselines, future-version boundaries, addendum scope, and disabled universal lab templates
- 126 named positive/negative boundary scenarios covering all 63 active rules
- 18 named interval scenarios covering every method across all 4 method-dependent rules
- 33 named cancer scenarios covering every disease-specific example listed in Part 06 of the PLAN
- 90 named vaccine scenarios covering all 11 vaccine families and all required applicable history states
- A 63-rule executable acceptance matrix covering the eligibility boundary, qualifying history, recurring-history uncertainty where relevant, abnormal-history routing, and every conflict variant through the production evaluator
- Exact status, due-start, due-end, precision, raw applicability, scenario linkage, and repeat-run determinism through `evaluateCarePlan`

## Commands run

```text
pnpm exec vitest run tests/rule-seeds.test.ts tests/rule-seed-scenarios.test.ts tests/rule-seed-cancer-acceptance.test.ts tests/rule-seed-vaccine-acceptance.test.ts tests/rule-seed-complete-matrix.test.ts src/domain/rules/evaluator.test.ts
pnpm rules:validate --json
pnpm exec tsx scripts/verify-sources.ts --as-of 2026-07-21 --json
pnpm typecheck
pnpm lint
```

The original 5-file rule/evaluator run passed 309 tests; the complete active-rule matrix added another 64 passing tests. Rule validation passed for 60 services, 77 methods, 63 active rules, 4 conflict groups, and 34 referenced sources with no issues. Offline source validation, typecheck, and lint passed.

## Known integration considerations

- Seed sources and services before rules; method-dependent seed schedules are authored with stable slugs and translated to database IDs.
- A future-effective or nonbaseline specialty variant must be selected explicitly and evaluated on an applicable `asOfDate`.
- Consumer summaries and limitations are explanatory metadata. Only the validated expressions, schedules, results, and effective dates drive calculations.
- New active rules must declare the complete scenario-class inventory and any method/variant scenarios before the catalog harness will accept them.
- The vaccine matrix intentionally preserves source boundaries: shared-decision rules remain discussions, a documented one-dose completion can be complete without an exact date, and only dose-series schedules calculate minimum intervals.

## Remaining limitations

- The catalog is a reviewed U.S.-adult starting set, not complete preventive-care coverage or individualized clinical safety guidance.
- Product-conditional schedules, all evidence-of-immunity paths, contraindication screening, and every condition-specific vaccine branch remain clinician-managed where the reviewed seed rules explicitly say the engine cannot calculate them.
- Source and rule review dates are fixed metadata and require maintainer review when guidance changes.

## No-core-TODO confirmation

No core placeholder service, source-free routine rule, universal annual lab rule, structurally untested active rule, PLAN cancer example, or required vaccine-matrix state remains untested.
