# Parts 05 and 07 — Rule authoring and deterministic engine

## Scope completed

- Pure date-only calendar arithmetic, precision normalization, local-date timezone conversion, and age calculation.
- Serializable rule authoring helpers, semantic validation, conflict-set validation, active-version immutability, and version cloning.
- Tri-state expression evaluation for every frozen expression node, including safe risk-path access and structured fact traces.
- Derived BMI, pack-year ranges, quit-time ranges, current-smoking state, medication classes, anatomy, conditions, and normalized family history.
- Deterministic care-event qualification with method/result checks, correction handling, duplicate suppression, future-event exclusion, and abnormal-history detection.
- Age-based, interval, one-time, seasonal, method-dependent, dose-series, shared-decision, and custom schedule evaluation.
- Due-range uncertainty propagation for exact, month-only, year-only, and unknown dates.
- Recommendation-class and status precedence, including the 90-day and Extra-attentive 180-day planning windows.
- Replacing and supplemental clinician overrides, general-guideline context, active-date checks, and conflicting-override rejection.
- Effective rule-version and conflict-variant selection, structured explanation tokens, safe calculation traces, deterministic hashes, and stable output ordering.

## Files added or changed

- `src/domain/dates/**`
- `src/domain/rules/**`
- `docs/handoffs/part-05-07-rules-engine.md`

The frozen files under `src/contracts/**` were not changed.

## Public contracts introduced

`src/domain/rules/index.ts` exports:

- `evaluateCarePlan(input)`
- `CarePlanEvaluationInput`, `EvaluationRule`, normalized domain input types, and `EngineEvaluatedRecommendation`
- Expression, event, schedule, override, status, variant, explanation, and derived-fact helpers
- Rule authoring and validation helpers

`EvaluationRule` adds runtime service/source display metadata to the frozen `GuidelineRuleDefinition`. `EngineEvaluatedRecommendation` remains assignable to the frozen `EvaluatedRecommendation` and adds general/personal due ranges plus a safe calculation trace.

`src/domain/dates/index.ts` exports date normalization, arithmetic, age, and timezone-local date helpers.

## Database changes

None.

## Tests added

The table-driven suite covers all expression nodes, all schedule kinds, all recommendation statuses/classes, authoring validation, age and stop boundaries, leap day, month-end arithmetic, timezone differences, BMI, multiple smoking periods, quit-year uncertainty, exact/month/year/unknown history, method isolation, dose series and minimum intervals, seasonal windows, outcome modifiers, overrides, versions, variants, duplicate/corrected/future events, deterministic hashes, traces, and sorting.

Named engine scenarios:

- `PROSTATE_SHARED_DECISION_AGE_57`
- `MAMMOGRAPHY_VARIANT_SWITCH`
- `COLORECTAL_NEWLY_ELIGIBLE_45`
- `COLORECTAL_COLONOSCOPY_METHOD_INTERVAL`
- `LUNG_FORMER_SMOKER_WITHIN_WINDOW`
- `LUNG_FORMER_SMOKER_OUTSIDE_WINDOW`
- `YEAR_ONLY_HISTORY_UNCERTAIN`
- `NO_CERVIX_ROUTINE_EXCLUDED`
- `ABNORMAL_HISTORY_CLINICIAN_MANAGED`
- `AAA_ONE_TIME_COMPLETE`
- `CLINICIAN_OVERRIDE_PRECEDENCE`

`PRIVATE_ADULT_PROFILE_DENIED` belongs to the authorization layer and is intentionally not modeled by this pure medical engine.

## Commands run

```text
pnpm exec prettier --check 'src/domain/dates/**/*.{ts,tsx}' 'src/domain/rules/**/*.{ts,tsx}'
pnpm exec eslint src/domain/dates src/domain/rules --max-warnings=0
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run src/domain/dates src/domain/rules --reporter=dot
pnpm exec vitest run src/domain/dates src/domain/rules --coverage --coverage.reporter=text
```

Final targeted result: 7 test files and 112 tests passed. Formatting, targeted lint, and full TypeScript checking passed.

## Integration considerations

- Persistence should adapt database rows into `EvaluationRule` and the normalized input types before calling the engine.
- February 29 birthdays use February 28 as the anniversary in non-leap years, matching the engine's calendar-year addition convention.
- `asOfDate` is always an explicit local ISO date. Callers converting an instant should use the profile timezone before evaluation.
- A supplemental clinician override retains the general due range and exposes its separate personal range. A replacing override controls the active due range.
- Active conflict groups must expose exactly one baseline variant. Contradictory profile selections and multiple replacing overrides are rejected.

## Remaining limitations

- Authorization and private-profile access are intentionally outside this pure domain package.
- The frozen input contracts do not carry a persistent profile eligibility-start date. An interval explicitly anchored to eligibility therefore uses the derived age threshold when available and the evaluation date otherwise.
- Supplemental personal actions are represented on the recommendation as `personalDueRange`; persistence/UI may materialize a separate personal action where needed.

No framework, network, or database dependency was added. No core TODO, placeholder, debug logging, or real health data remains in the owned paths.
