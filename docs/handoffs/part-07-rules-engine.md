# Part 07 — Pure deterministic recommendation engine

## Scope completed

- Added pure ISO calendar arithmetic, precision normalization, timezone-local date conversion, age, BMI, tobacco exposure, anatomy, condition, family-history, and medication-class derivation.
- Added tri-state expression evaluation, effective-version and variant selection, event qualification, corrections/future-event handling, every schedule kind, uncertainty propagation, clinician overrides, status precedence, explanations, deterministic hashes, and stable sorting.
- Added safe user-facing calculation traces and optional test/development expression traces without framework, database, network, or implicit-clock dependencies.

## Files added or changed

- `src/domain/dates/**`
- `src/domain/rules/**`
- `src/domain/rules/__tests__/fixtures.ts`

## Public contracts introduced

- `evaluateCarePlan(input)`
- `CarePlanEvaluationInput`, `EvaluationRule`, normalized domain inputs, and `EngineEvaluatedRecommendation`
- Date normalization, calendar arithmetic, age, and timezone helpers
- Expression, fact, event, schedule, override, status, variant, explanation, and authoring helpers exported by `src/domain/rules/index.ts`

## Database changes

None.

## Tests added

- Every expression node, schedule kind, recommendation status/class, boundary age, leap-day/month-end/timezone path, and history precision
- Method isolation, one-time completion, series minimum intervals, seasonal windows, shared decisions, insufficient evidence, recommendation against, variants, versions, overrides, abnormal/corrected/duplicate/future events, hashes, traces, and sorting
- Eleven medical named scenarios; the twelfth required privacy-denial scenario is correctly covered by Part 03 because the pure engine has no actor or authorization input

## Commands run

```text
pnpm exec vitest run src/domain/dates src/domain/rules
```

Result: 7 files and 113 tests passed.

## Known integration considerations

- Persistence adapters must validate database JSON and construct `EvaluationRule` runtime service/source metadata before calling the engine.
- `asOfDate` is an explicit profile-local ISO date. The engine never reads current time.
- General and supplemental personal due ranges remain distinct; replacing overrides control the active range.
- Conflict groups require one baseline variant unless the caller supplies an available explicit selection.

## Remaining limitations

- Authorization and profile privacy are intentionally outside this pure package.
- The frozen input has no persistent eligibility-start date, so an eligibility-anchored interval uses the age threshold when present and `asOfDate` otherwise.
- Supplemental personal actions are returned as `personalDueRange`; persistence/UI decides whether to materialize a separate action.

## No-core-TODO confirmation

No core Part 07 TODO, database/network dependency, implicit time read, placeholder schedule, or debug logging remains.
