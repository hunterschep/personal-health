# Parts 04 and 17 handoff — sources

## Scope completed

- Added a validated 38-entry current source metadata registry covering the researched USPSTF, CDC/ACIP, HRSA, MyHealthfinder, ACS, and ACC/AHA sources.
- Recorded draft, future-effective, operative-schedule, addendum, federal-versus-specialty, and CDC-versus-USPSTF version boundaries without defining active medical eligibility logic.
- Added an anonymous MyHealthfinder API v4 client with a strict runtime allowlist, local date-of-birth-to-age conversion, HTTPS-only fixed endpoint, timeout, bounded transient retry, Retry-After handling, response-size limit, structure validation, and HTML sanitization.
- Added deterministic anonymous cache keys and cache services with fresh-cache use, last-successful fallback, retained prior revisions, changed/unreviewed state, review state, fetch dates, sync logs, in-memory/file adapters, and a repository-backed adapter for the Prisma repositories.
- Added structural source/rule verification, source freshness thresholds, optional live URL checks, human/JSON output, source inventory reporting, and MyHealthfinder sync scripts.
- Added reusable source citation, metadata, attribution, cached-content, stale-source, comparison, and source-content-boundary components.
- Documented the complete register, operator workflow, privacy boundary, attribution requirements, and critical current-version decisions.

## Files added or changed

- `src/server/sources/**`
- `src/components/sources/**`
- `scripts/verify-sources.ts`
- `scripts/sync-myhealthfinder.ts`
- `scripts/source-report.ts`
- `docs/source-register.md`
- `docs/handoffs/part-04-17-sources.md`

## Public contracts introduced

- `SOURCE_REGISTRY` and `toGuidelineSourceSeed`
- `SourceRegistryEntry`, `PublicSourceMetadata`, freshness/change states
- `AnonymousMyHealthfinderInput` and `toAnonymousMyHealthfinderInput`
- `MyHealthfinderClient`
- `SourceCacheStorage`, `loadMyHealthfinderContent`, and repository/file/in-memory adapters
- `verifySourceStructure`, `verifyLiveSourceUrls`, and source report helpers

## Database changes

None. The implementation consumes the Part 02 `GuidelineSource`, `ExternalContentCache`, and `SourceSyncLog` repositories through an adapter. Source seed code should import `SOURCE_REGISTRY` and `toGuidelineSourceSeed`.

## Tests added

- Strict PII rejection before any HTTP request.
- Date of birth stays local; only the anonymous allowlist enters the query.
- Anonymous cache keys are deterministic and opaque.
- Timeout, bounded retry, Retry-After, permanent-error, malformed-content, and response validation paths.
- Script and dangerous-attribute removal.
- Fresh cache, live failure fallback, stale labeling, revision retention, and changed-content review state.
- Registry validity and critical version boundaries.
- Offline verification, stale-state reporting, effective-date checks, conflict baselines, required attribution, and explicit live mode.
- Required MyHealthfinder attribution and app/source content separation in rendered components.

## Commands run

```text
pnpm exec vitest run src/server/sources src/components/sources --reporter=verbose
pnpm exec tsx scripts/verify-sources.ts --as-of 2026-07-21
pnpm exec tsx scripts/source-report.ts --as-of 2026-07-21
pnpm exec tsx scripts/verify-sources.ts --live --as-of 2026-07-21
SOURCE_CACHE_FILE=<temporary-path> pnpm exec tsx scripts/sync-myhealthfinder.ts --file-cache
pnpm exec tsc --noEmit --pretty false
```

The final targeted run passed 27 tests across 6 files. Offline verification passed for 38 sources, and full type checking passed. The initial live check identified three incorrect USPSTF slugs, which were corrected; the final live check passed with seven bot-protection warnings from official sites. The standalone sync smoke test fetched and stored all six anonymous profiles successfully with no fallback or failure.

## Integration considerations

- Seed `SOURCE_REGISTRY` before running database-backed MyHealthfinder sync.
- Normal CI should call offline `sources:verify`; live mode is operator-controlled.
- The verification script discovers exported rule arrays from `prisma/seed/rules.ts` or `src/domain/rules/catalog.ts`, or accepts `--rules <module-or-json>`.
- MyHealthfinder cached payloads use a versioned envelope inside `payloadJson` so prior revisions and review state survive the single-row cache schema.
- Public code should use `getPublicSourceMetadata`; it omits internal reviewer notes.
- Consumer content may enrich explanations only. It is not an input to the deterministic evaluator.

## Remaining limitations

- Live source checks cannot distinguish bot protection from an operator network restriction; 403/406 responses remain warnings while confirmed 404/410 responses fail live verification.
- MyHealthfinder supports only its published binary `sex` parameter. Unsupported or undisclosed values skip enrichment rather than being coerced.
- The file cache adapter is for explicit standalone operation; normal application operation should use the database adapter.

## Completion confirmation

No core TODOs, placeholder source records, active scraped medical logic, or PII-bearing source requests remain in the owned paths.
