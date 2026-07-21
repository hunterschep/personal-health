# Part 17 — Sources center, provenance UI, rule maintenance operations, and stale-content handling

## Scope completed

- Implemented source index, source detail, service provenance, and source-activity routes with organization/category/freshness/evidence/variant/activity filters.
- Added canonical metadata, attribution, services, active and retired rule versions, methods, conflicts, freshness, cached availability, and revision presentation without reviewer credentials.
- Stale sources continue deterministic evaluation with review-due notices; changed external content is retained and never mutates active rule logic.
- Added offline/live source verification, sync/report/review, checked-in/database rule validation, semantic rule-version comparison, and scoped/resumable recommendation rebuild commands.

## Files added or changed

- Source index/detail/service/activity pages
- `src/components/sources/**`
- `src/server/read-models/source-transparency.ts`
- `src/server/sources/**`
- `scripts/verify-sources.ts`, `scripts/sync-myhealthfinder.ts`, `scripts/source-report.ts`
- `scripts/validate-rules.ts`, `scripts/rule-diff.ts`, `scripts/diff-rules.ts`, and `scripts/rebuild-recommendations.ts`
- `docs/source-register.md` and rule-maintenance documentation

## Public contracts introduced

- `loadSourceCenter`, `filterSourceCenterRows`, `loadSourceDetail`, `loadServiceProvenance`, and `loadSourceChanges`
- Source freshness, lifecycle, attribution, cached revision, and public metadata contracts
- Source verification/report and checked-in rule validation command interfaces
- Persisted cached-content review decisions with approved, rejected, and acknowledged outcomes plus a value-free database audit action
- Semantic `rules:diff --from <version> --to <version>` reports with an optional stable-key filter, JSON output, affected scenarios, conservative profile estimates, and snapshot-rebuild classification

## Database changes

Part 17 uses the initial migration's `GuidelineSource`, `GuidelineRule`, `SourceSyncLog`, `ExternalContentCache`, service/method, selection, and recommendation tables. Review decisions live in the validated private cache envelope, so no separate Part 17 migration was required.

## Tests added

- Source filters, freshness, attribution, active/retired variants, and public metadata boundaries
- Cache fallback/revision retention and changed-content isolation from rules
- Offline/live verification structure, rule/source coherence, and source presentation
- Rule validation and database seed comparison through release gates
- Rule-diff argument validation, canonical semantic comparisons, schedule/source/summary/eligibility changes, stable-key filtering, affected scenarios, profile estimates, and activation-aware rebuild classification
- Cached-content review-decision validation and persistence

## Commands run

- `pnpm sources:verify`
- `pnpm rules:validate`
- `pnpm rules:diff --check`
- `pnpm exec vitest run tests/rule-diff.test.ts`
- `pnpm test:coverage`
- `pnpm build`

The focused semantic-diff suite passed 10 tests. The integrated results are recorded in `docs/release-report.md`.

## Known integration considerations

- Source freshness is a review signal, not a claim that official guidance is invalid.
- External consumer content can enrich explanations but never controls eligibility, cadence, or status.
- Medical rule changes remain reviewed code/seed changes; there is intentionally no web JSON rule editor.
- Semantic comparison works offline from retained seed versions. With `DATABASE_URL`, retained database versions are included and the profile estimate is a jurisdiction-level upper bound rather than an eligibility simulation.

## Remaining limitations

- Profile estimates and rule-scoped rebuilds intentionally use a jurisdiction-level conservative candidate set; unchanged calculation hashes prevent unrelated snapshot replacement.

## No-core-TODO confirmation

No core Part 17 TODO, stale-source evaluation shutdown, unreviewed-content decision gap, semantic rule-diff placeholder, fake rebuild option, or web-based arbitrary rule editor remains.
