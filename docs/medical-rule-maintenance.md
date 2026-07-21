# Medical rule maintenance

CareCadence medical logic is reviewed, versioned application data. External pages, API responses, scrapers, and language models may help a maintainer notice a possible change, but none of them may activate or rewrite a rule.

## Current catalog

The initial reviewed catalog contains 60 stable services, 77 service-scoped methods, and 63 rule versions. Thirty-nine services have source-backed or explicit source-boundary rules. The remaining routine-maintenance and lab-library services are records or editable templates only; they do not become overdue until a user or clinician supplies a cadence.

Authoritative files:

- `src/server/sources/registry.ts` — official source metadata and version boundaries.
- `prisma/seed/catalog.ts` — stable services and methods.
- `prisma/seed/rules.ts` — reviewed, serializable rule definitions.
- `src/domain/rules/authoring.ts` — schema validation and authoring helpers.

Run the offline review checks with:

```bash
pnpm rules:validate
pnpm sources:verify
pnpm test -- tests/rule-seeds.test.ts
```

When a database is available, verify that its immutable rule rows still match the checked-in
definitions:

```bash
DATABASE_URL=postgresql://... pnpm rules:diff --check
```

## Review workflow

1. Open the current official primary source. Record its canonical URL, organization, publication or effective date when available, and the date it was verified.
2. Compare the official source with the registered version and existing active rule. Do not treat a changed web page as an approved rule change.
3. Add or update source metadata. Draft and future-effective sources remain visibly separate from current sources.
4. Add a service or service-scoped method only when the stable catalog does not already represent it.
5. Clone the prior rule to a new integer version. Never edit an active database version in place.
6. Encode only criteria and intervals supported by the cited source. Put unmodeled criteria and uncertainty in `limitations`.
7. Add positive, negative, boundary, approximate-date, abnormal-result, and method-specific scenario IDs as applicable. Add executable engine scenarios for behavior that is not already covered.
8. Run validation, source verification, focused tests, type checking, and the full test suite.
9. Review the database diff, seed the new immutable version, and rebuild affected recommendation snapshots.
10. Record the source and visible behavior change in the release notes or source register.

## Services and methods

A service is a stable kind of care record, not a claim that the care is universally recommended. Keep the slug stable. Give every service a unique event type so an unrelated screening event cannot satisfy its history.

Methods are scoped to one service. A rule seed refers to a readable method slug. During database seeding, CareCadence resolves that slug to the service method UUID and stores only the runtime UUID in executable JSON. This prevents raw placeholder IDs from reaching the evaluator.

Method-dependent rules must include every scheduled method in `allowedMethods` and a named scenario for each method. Never substitute one method's interval for another. When a combination strategy cannot be represented faithfully, use a conservative prompt or clinician override and state the limitation.

## Sources

Add sources to the registry only after verifying an official HTTPS URL. Record unavailable publication or effective dates as `null`; do not invent them. A rule still needs an activation date, which may be a clearly labeled CareCadence review date when a specialty source does not publish one.

The source hierarchy is:

1. Final USPSTF A and B recommendations.
2. Operative CDC/ACIP adult immunization guidance.
3. HRSA-supported preventive services.
4. MyHealthfinder consumer explanations.
5. Labeled specialty alternatives.
6. Disabled, app-authored maintenance templates.

MyHealthfinder text is consumer enrichment only. Store it with required attribution and revision metadata. A changed content hash remains unreviewed and cannot alter eligibility, intervals, or recommendation class.

## Rules and variants

Use `defineRule` and the expression and schedule factories. Risk paths are allowlisted. If the profile cannot represent a required source criterion, prefer an unknown-history or discussion state over a false routine task.

Each rule needs:

- Stable key and positive integer version.
- Service, source, variant, and optional conflict group.
- Recommendation class and evidence label.
- Eligibility, exclusion, and stop expressions.
- A schedule and allowed completion methods.
- Plain-language summary, rationale, clinician questions, and limitations.
- Effective dates, review status, reviewer label, review date, and scenarios.

Variants that answer the same question share a conflict group. Exactly one baseline **variant** is active. One variant may contain several non-overlapping age segments, and each segment may be marked as part of that baseline variant. Specialty choices remain separate; never blend their ages, methods, or intervals with the federal baseline.

## Version activation and retirement

To replace a rule:

1. Give the old version an `effectiveTo` date through a reviewed version-governance operation.
2. Clone it with the same stable key, increment the version, and set the new `effectiveFrom` date.
3. Keep the old version and prior recommendation snapshots for history.
4. Compare the reviewed versions with `pnpm rules:diff --from 1 --to 2`. Add
   `--rule <stableKey>` to focus one rule and `--json` for machine-readable output.
5. Seed, then rebuild profiles affected by the service, jurisdiction, or variant.
6. Show a guideline-updated event only when a profile's visible plan meaningfully changes.

Retirement never deletes source or snapshot history. A clinician override does not rewrite the general guideline; it adds a personal plan with provenance.

## Reviewing a rule-version diff

Keep both immutable versions in `GUIDELINE_RULE_SEEDS` while reviewing a replacement. Compare all
stable keys that have both requested versions:

```bash
pnpm rules:diff --from 1 --to 2
pnpm rules:diff --from 1 --to 2 --rule colorectal-uspstf-average-risk-45-75
pnpm rules:diff --from 1 --to 2 --json
```

The report shows the stable key, old and new version, eligibility expressions, schedules, source
metadata, summaries and limitations, expected affected scenario IDs, and whether activation needs a
snapshot rebuild. A target version in `draft` or `reviewed` state does not request a rebuild until it
becomes active.

The comparison works from checked-in seed definitions without a database. When `DATABASE_URL` is
set, it also loads retained database-only rule versions and reports a conservative affected-profile
estimate. The estimate counts active profiles in the target rule's jurisdiction; it is a planning
upper bound, not a claim that every counted profile is eligible.

`pnpm rules:diff --check` remains a separate deployment guard. It compares the full checked-in rule
definition with the target database, including normalized method identifiers, and exits nonzero for
missing or changed seed versions. Historical database-only versions are reported but do not make the
check fail.

## Reviewing changed cached source content

External content whose hash changes remains marked `changed_unreviewed` until a maintainer records
an explicit decision. Inspect the retained revisions, then record the decision against the opaque
cache key shown by maintenance diagnostics:

```bash
pnpm sources:review --source myhealthfinder-consumer-content-v4 \
  --cache-key 'myhealthfinder:v4:<hash>' \
  --decision approved \
  --reviewer 'Maintainer name' \
  --note 'Compared with the registered source on 2026-07-21.'
```

Valid decisions are `approved`, `rejected`, and `acknowledged`. The decision, reviewer label,
timestamp, and optional note are persisted inside the private cache envelope. A decision never
activates or rewrites medical logic; rule changes still require a reviewed immutable rule version.
Database-backed reviews also create a value-free `source.content_reviewed` audit action containing
only the seeded source identifier and decision class. Use `--file-cache` when reviewing the
explicitly configured JSON-file cache; that mode retains the decision in the protected file but has
no database audit log.

## Current version boundaries

- The final 2018 USPSTF cervical statement remains the federal baseline. The 2024 draft is registered but cannot back an active rule.
- The HRSA cervical update is effective for plan years beginning in 2027. Its rule cannot evaluate before `2027-01-01`.
- Under the current federal injunction boundary, the operative CDC adult schedule is dated July 2, 2025. Only the separately reviewed April 27, 2026 RSV amendment is applied from the later addendum.
- Current operative COVID schedule content is not sufficiently consistent for a calculated dose cadence. The seeded item is a discussion state and never becomes overdue.
- Specialty breast, cervical, and lipid guidance is available only as a labeled alternative.

## Known representation limits

The first rule version deliberately avoids false precision:

- It does not calculate life expectancy, procedural fitness, fracture risk, or 10-year cardiovascular risk.
- It does not infer pregnancy, menopause, evidence of immunity, or sensitive exposure details that a user has not supplied.
- Product-conditional vaccine series that exceed the current DSL use conservative discussion states or explicit limitations.
- Unknown, approximate, abnormal, and inconclusive history does not silently become normal completion.
- Routine-maintenance templates and lab-library records have no universal active cadence.

Document a new limit next to the affected rule and in a scenario. Do not add a compatibility fallback that silently changes medical meaning.
