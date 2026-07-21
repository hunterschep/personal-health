# Part 08 — Recommendation snapshots, recalculation, and change history

## Scope completed

- Added a database adapter that loads a profile's normalized context and active source-backed rules, calls the pure evaluator, and maps results into persistent recommendation snapshots.
- Added snapshot synchronization that preserves unchanged rows by calculation hash, retires changed or stale rows, creates replacements, and retains historical rows for timeline reads.
- Wired recommendation rebuilding into onboarding, profile/context edits, care events, history assertions, medications, guideline selection, CSV commit, and clinician-override mutations, normally inside the caller's transaction.
- Added profile care-plan, overview, timeline, source-transparency, detail, reminder-candidate, and visit-prep read models over active or historical snapshots.
- Added an actor- and reason-aware rebuild contract that authorizes interactive callers, classifies every meaningful plan change, writes value-free rebuild audits, and emits only redacted, privacy-permitted household activity.
- Added a resumable rebuild command with all-profile, household, profile, rule, and changed-rule scopes plus dry-run, fixed-date, batch-size, and cursor controls.
- Persisted reviewed normalized medication class codes and mapped only those explicit codes into production evaluation input. Medication names are never used to infer a class.

## Files added or changed

- `src/server/recommendations/**`
- `src/server/repositories/recommendation.ts`
- `src/server/db/workflows.ts`
- Recommendation-triggering profile API routes
- `src/server/read-models/**`
- `scripts/rebuild-recommendations.ts`
- `src/test/integration/data-layer.test.ts`

## Public contracts introduced

- `buildCarePlanEvaluationInput(database, profileId, asOfDate)`
- `rebuildProfileRecommendations({ profileId, actorUserId, asOfDate, reason, dryRun? }, database?)`
- `RecommendationRebuildReason`, `RecommendationChangeType`, `RecommendationChange`, and `RebuildResult`
- `classifyRecommendationChanges` and `recommendationChangeCounts`
- `explicitMedicationClassCodes` for the persisted, no-name-inference medication mapping
- Backward-compatible `rebuildRecommendations(database, profileId, asOfDate?, context?)` for transaction workflows
- `RecommendationRepository`, `RecommendationSnapshotInput`, `SnapshotSyncResult`, and `synchronizeActiveSnapshots`
- Authorized profile care-plan, overview, detail, timeline, source, and visit-prep read models

## Database changes

Part 08 uses `RecommendationInstance`, including rule/source identity, status/class, due range, qualifying event, override, explanation JSON, matching-fact JSON, calculation hash, evaluation date, and retirement timestamp. `20260721060000_normative_surface_gaps` adds `Medication.classCodesJson` for explicit normalized medication-class input.

## Tests added

- Repository snapshot identity and persistence-class mapping
- PostgreSQL integration cases for unchanged hash reuse, rollback, authorized/idempotent rebuilding, display-only edits, dry-run non-persistence, value-free audit history, and private-versus-shared activity
- Route tests asserting one rebuild for relevant context, care-event, import, medication, history, variant, and override mutations
- Read-model tests for timeline history and source transparency
- Pure change-classification and complete CLI-option parser tests
- Explicit medication-class mapping and medication edit/API tests that prove persisted codes, not medication names, feed rebuilding

## Commands run

```text
pnpm exec vitest run <17 focused Part 08/12/14/15/16 test files>
pnpm typecheck
pnpm lint
pnpm exec prisma validate
```

Result: 17 files and 41 focused tests passed; typecheck, lint, and schema validation passed. The PostgreSQL integration suite remains part of the final fresh-database release gate.

## Known integration considerations

- Interactive callers pass the acting user and a specific reason. Local maintenance jobs pass a null system actor and run only through the command-line entry point.
- Rebuilds use profile-local dates when no fixed date is supplied. Deterministic jobs and tests should pass an explicit date.
- Read models consume snapshots for speed; care events, profile context, clinician plans, selected variants, and reviewed rules remain the source of truth.
- The CLI is resumable by sorted profile cursor and idempotent because identical calculation hashes do not create replacement rows.

## Remaining limitations

- The database care-event model has no correction, series-key, or dose-ordinal fields exposed to the evaluator. Dose order is inferred from event order; those richer event inputs are not persisted end to end.
- Process-local CLI execution does not provide multi-worker leasing. The included single-instance maintenance topology uses deterministic profile ordering and an explicit resume cursor instead.

## No-core-TODO confirmation

No core Part 08 TODO, unauthenticated interactive rebuild, unclassified visible change, privacy-leaking activity payload, placeholder snapshot, or fake maintenance option remains.
