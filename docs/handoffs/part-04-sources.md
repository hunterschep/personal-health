# Part 04 — Source registry, MyHealthfinder integration, caching, and attribution

## Scope completed

- Added a validated 38-entry registry for USPSTF, CDC/ACIP, HRSA, MyHealthfinder, ACS, and ACC/AHA provenance, including draft/current, baseline/specialty, addendum, and future-effective boundaries.
- Added an anonymous MyHealthfinder v4 client with a fixed HTTPS endpoint, allowlisted inputs, local date-of-birth conversion, timeout, bounded retry, response-size and shape validation, and sanitization.
- Added deterministic anonymous cache keys, retained revisions, freshness/change/review state, last-successful fallback, file/in-memory/database adapters, sync logs, verification, reporting, and operator scripts.
- Added source metadata, citation, attribution, comparison, stale-state, and cached-content presentation components plus the maintained source register.

## Files added or changed

- `src/server/sources/**`
- `src/components/sources/**`
- `scripts/verify-sources.ts`, `scripts/sync-myhealthfinder.ts`, and `scripts/source-report.ts`
- `prisma/seed/sources.ts`
- `docs/source-register.md`

## Public contracts introduced

- `SOURCE_REGISTRY`, `getSourceBySlug`, `getPublicSourceMetadata`, and `toGuidelineSourceSeed`
- `SourceRegistryEntry`, `PublicSourceMetadata`, freshness/change states, and attribution metadata
- `AnonymousMyHealthfinderInput`, `MyHealthfinderClient`, anonymous cache-key helpers, and validated content types
- `SourceCacheStorage`, `loadMyHealthfinderContent`, and repository/file/in-memory adapters
- `verifySourceStructure`, optional live verification, and source report helpers

## Database changes

No Part 04 migration. The implementation uses the Part 02 `GuidelineSource`, `ExternalContentCache`, and `SourceSyncLog` tables and repositories.

## Tests added

- PII rejection before HTTP, anonymous query construction, opaque cache keys, timeout/retry/error/size/shape handling, and HTML sanitization
- Fresh cache, fallback, stale labels, retained revisions, changed-content review state, and registry version boundaries
- Offline structural verification, source/rule coherence, attribution, and rendered source/app-content separation

## Commands run

```text
pnpm exec vitest run src/server/sources src/components/sources
pnpm exec tsx scripts/verify-sources.ts --as-of 2026-07-21 --json
```

Results: 6 files and 28 tests passed. Offline verification passed for 38 sources, 37 active sources, and 63 rules with no issues.

## Known integration considerations

- Seed the registry before running database-backed source sync.
- Normal CI uses offline `sources:verify`; live URL checks are explicit operator work because official sites may use bot protection.
- Public presentation should use `getPublicSourceMetadata`, which excludes internal review notes.
- Cached consumer text may enrich explanations but never changes rule eligibility, status, or due dates.

## Remaining limitations

- Live checks cannot always distinguish source-site bot protection from local network policy; confirmed 404/410 failures remain actionable while some access denials are warnings.
- MyHealthfinder exposes a binary `sex` parameter. Unsupported or undisclosed values skip enrichment rather than being coerced.
- The file adapter is for explicit standalone operation; the normal application path uses PostgreSQL.

## No-core-TODO confirmation

No core Part 04 TODO, placeholder source, active scraped rule logic, unsanitized source rendering, or PII-bearing MyHealthfinder request remains.
