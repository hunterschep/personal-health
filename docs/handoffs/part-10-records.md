# Part 10 — Care events, guided backfill, bulk entry, and CSV import

## Scope completed

- Implemented authorized care-event create, read, update, soft delete, safe restore, attachment, and recommendation rebuild flows with exact and approximate date precision.
- Added a resumable guided backfill queue with never-completed, unsure, unknown-date completion, skip, method, and result semantics.
- Added keyboard-oriented bulk entry with row duplication, tabular paste, local/server validation, warning selection, transactional commit, duplicate detection, and a mobile card layout.
- Added size/row/formula-safe two-phase CSV preview and idempotent commit plus searchable/filterable record history.
- Guided backfill now stores optional provider/note details and a reason-required reversible not-applicable response without overriding rule-engine eligibility.
- Records now expose category, year, missing-date, abnormal-or-clinician-managed, imported, and document views; search includes service, method, provider, and year.

## Files added or changed

- `src/components/records/**`
- Record, backfill, bulk-entry, import, and event-detail pages
- `src/app/api/profiles/[profileId]/care-events/**`
- `src/app/api/profiles/[profileId]/backfill/route.ts`
- `src/app/api/profiles/[profileId]/import/**`
- `src/server/imports/**` and care-event repository/workflow code

## Public contracts introduced

- `careEventInputSchema` and normalized date/result/source contracts
- CSV preview, row resolution, commit-token, warning-selection, and import-result contracts
- Profile service-history assertions for never, unsure, skipped, and completion precision states
- Reason-bearing `not_applicable_claim` assertions and pure requested-view record filters

## Database changes

Part 10 uses the initial migration's records models. Migration `20260721061000_history_assertion_reason` adds the bounded optional reason for personal history assertions.

## Tests added

- Care-event authorization, attachment serialization, rebuild, delete, and restore behavior
- Backfill assertions and reset behavior
- Bulk duplicate/paste/validation behavior
- CSV limits, formula rejection, service/method resolution, duplicate warnings, idempotent commit, and profile scoping
- Backfill provider/note persistence, required not-applicable reasons, and all requested record filters

## Commands run

- `pnpm test:coverage`
- `pnpm typecheck`
- `pnpm build`
- Focused Part 09–11 suite: 33 tests passed; focused ESLint and Prisma generation/validation passed. The latest workspace typecheck was blocked by a concurrent reminder-schema/client mismatch outside this scope.

The integrated results are recorded in `docs/release-report.md`.

## Known integration considerations

- Event and batch commits rebuild once within their transaction; care events and rules remain source of truth.
- A deleted event with a physically purged attachment is intentionally non-restorable and returns an explicit explanation.
- Import previews hold normalized batch data, not raw uploaded CSV bytes.

## Remaining limitations

None of the previously recorded Part 10 acceptance limitations remain. Bulk entry exposes the requested attachment indicator; actual document upload remains in the validated individual-record flow.

## No-core-TODO confirmation

No literal TODO/FIXME, fake dated not-applicable event, engine-status override, partial batch commit, or missing requested record view remains in this scope.
