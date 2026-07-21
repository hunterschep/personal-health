# Part 11 — Overview dashboard, care plan, and recommendation detail

## Scope completed

- Implemented a profile-aware overview with privacy/mode context, routine-item denominator explanation, next actions, annual planning, and visit-prep entry points.
- Added grouped care-plan sections, search/status/category filters, status-aware cards, planning/record actions, and view-only behavior.
- Added authorized recommendation detail covering eligibility facts, exact calculation trace, uncertainty, accepted methods, history, personal plans, variants, benefits/limitations, questions, provenance, and retired snapshot history.
- Added explicit guideline-variant selection/reset with confirmation and recommendation rebuild. The saved result now stays visible as a concrete before/after status and due-range comparison with classified change counts before the user opens the recalculated snapshot.
- Overview now shows exact attention/year/unknown/discussion metrics, a labeled actionable-routine ring, the next active-rule age milestone, and at most three priority actions.
- Added every requested filter plus grouped, compact, source-comparison, and print views with a per-user non-sensitive view preference.
- Cards now reach completion confirmation, planning, clinician instruction, reminder-only snooze, reasoned personal response, and detail actions.

## Files added or changed

- `src/app/(app)/app/page.tsx`
- Care-plan list, recommendation-detail, and override pages
- `src/components/care-plan/**`
- `src/server/read-models/profiles.ts`
- `src/server/read-models/recommendation-detail.ts`
- Guideline-selection and service-history response routes

## Public contracts introduced

- `loadProfileCarePlan`, `profileSummary`, and `loadRecommendationDetail`
- Recommendation-card, variant-comparison, response-action, and clinician-plan view contracts
- Authorized profile/recommendation detail and variant selection endpoints; selection responses include the prior and active recommendation summaries plus rebuild change counts by type
- `filterCarePlanRecommendations`, `findNextAgeMilestone`, and `summarizeCarePlanRecommendations`

## Database changes

Part 11 reads the initial migration's recommendation snapshots, guideline selections, rules, sources, history states, planned actions, reminders, and clinician overrides. No separate Part 11 migration was added.

## Tests added

- Read-model calculation/provenance parsing and source-freshness behavior
- Guideline selection and baseline reset/rebuild routes, including the classified before/after response contract
- Guideline selector before/after rendering and recalculated-snapshot handoff
- Recommendation response semantics, profile authorization, source fallback, and browser care-plan journeys
- Exact overview metrics/denominator, milestone selection, all filter dimensions, and card-action reachability

## Commands run

- `pnpm test:coverage`
- `pnpm typecheck`
- `pnpm build`
- Focused Part 09–11 suite: 33 tests passed; focused ESLint passed. The latest workspace typecheck was blocked by a concurrent reminder-schema/client mismatch outside this scope.

The integrated results are recorded in `docs/release-report.md`.

## Known integration considerations

- The UI reads rebuildable snapshots; profile context, history, rules, selected variants, and clinician instructions remain authoritative.
- Planning and response actions never silently create a completed care event or change a medical due date.
- Shared-decision and insufficient-evidence copy remains separate from routine overdue language.

## Remaining limitations

None of the previously recorded Part 11 acceptance limitations remain. Snooze is shown only when a pending reminder exists and changes reminder display rather than recommendation status.

## No-core-TODO confirmation

No literal TODO/FIXME, opaque recommendation detail, unsupported urgency label, or unreachable requested card action remains in this scope.
