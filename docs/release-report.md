# CareCadence 1.0 release report

## Release identity

- Build identifier: `carecadence-1.0.0-20260721`
- Package version: `1.0.0`
- Verification date: July 21, 2026
- Intended deployment: one self-hosted application instance with PostgreSQL and private local file storage

This report records the completed version-one implementation and the checks performed against it. It is a software release report, not medical approval, clinical validation, a HIPAA-compliance assessment, or a claim of zero security risk.

## Completed product scope

The release includes:

- Household registration, Argon2id credentials, database-backed sessions, sign-out, local administrator recovery, and authentication throttling.
- Multiple adult profiles with owner-only or household sharing, adult-profile claim and grant/revoke flows, neutral authorization failures, and persistent profile selection.
- Guided adult onboarding for demographics, relevant anatomy, risk context, conditions, medications, and preventive-care history.
- A deterministic, versioned rules engine that produces immutable recommendation snapshots with due-state explanations, missing-information prompts, source citations, guideline comparisons, conflicts, and clinician-plan precedence.
- Overview, care plan, recommendation detail, timeline, annual calendar, family, medication, sharing, visit-prep, reminders, source center, and settings experiences.
- Exact and approximate record entry, guided backfill, bulk entry, validated CSV import, duplicate review, recalculation, custom maintenance, clinician overrides, appointments, and private calendar export.
- Authenticated private-document upload and download, content validation, opaque storage keys, soft deletion, retryable physical cleanup, backup inclusion, and cross-account denial.
- Profile and household data export, profile deletion, household deletion, audit events, and redacted household activity.
- In-app reminders, optional SMTP delivery, an idempotent dispatch command, and a protected optional HTTP cron endpoint.
- Offline public shell behavior without caching authenticated health data, responsive navigation, print views, dark mode, reduced-motion support, focus management, and accessibility smoke tests.
- Idempotent source/rule/demo seed data, source verification and sync tooling, rule validation and diff tooling, recommendation rebuild tooling, Docker Compose deployment, health checks, backup/restore scripts, and CI.

## Architecture summary

CareCadence is a server-first Next.js 16 and React 19 monolith. PostgreSQL 18 holds identity, authorization, medical context, catalog versions, snapshots, reminders, and audit data through Prisma 7. Private documents are stored outside the public tree and served only through authorized handlers. The pure TypeScript rules engine consumes normalized local-date facts and checked-in, source-linked rule versions; external consumer content can enrich explanations but does not decide eligibility or timing.

The Compose deployment runs PostgreSQL, a one-shot non-root migration/seed initializer, and a non-root standalone web image. Readiness checks both PostgreSQL and private storage. See [architecture.md](architecture.md) and [privacy-model.md](privacy-model.md) for boundaries and threat assumptions.

## Catalog and rule inventory

| Inventory           | Count | Verification                                                       |
| ------------------- | ----: | ------------------------------------------------------------------ |
| Registered sources  |    38 | Includes one future and one inactive source version                |
| Active sources      |    37 | Every active rule citation resolves to an active source            |
| Preventive services |    60 | Stable after repeated seed runs                                    |
| Methods             |    77 | Stable after repeated seed runs                                    |
| Active rules        |    63 | All parsed, resolved, and evaluated by the validation command      |
| Conflict groups     |     4 | Deliberately represented for comparison and shared decision-making |
| Rule-linked sources |    34 | Reported by rule validation                                        |

The catalog covers the required version-one U.S. adult preventive services. It is not complete coverage of every specialty guideline, risk factor, rare condition, or possible preventive-care decision.

## Automated verification

All commands below were run from the repository root with Node.js 22, pnpm 11.9, and a clean PostgreSQL database where applicable.

| Command or gate                                         | Result                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                        | Passed with the committed lockfile                                                                                       |
| `pnpm db:generate`                                      | Passed                                                                                                                   |
| `pnpm exec prisma validate`                             | Passed                                                                                                                   |
| `pnpm db:migrate:deploy`                                | Eight committed migrations applied cleanly to an empty database                                                          |
| `pnpm db:seed` twice                                    | Passed; repeated seed retained 38 sources, 60 services, 77 methods, 63 rules, 2 demo users, and 4 demo profiles          |
| `pnpm format`                                           | Passed                                                                                                                   |
| `pnpm lint`                                             | Passed with zero warnings                                                                                                |
| `pnpm typecheck`                                        | Passed                                                                                                                   |
| `pnpm test:coverage`                                    | 133 test files and 853 tests passed; coverage was 67.20% statements, 61.43% branches, 64.53% functions, and 69.04% lines |
| `pnpm sources:verify`                                   | Passed with no errors or warnings and no network dependency                                                              |
| `pnpm sources:verify --live`                            | Passed with no errors and seven upstream HTTP warnings described below                                                   |
| `pnpm rules:validate`                                   | Passed: 60 services, 77 methods, 63 active rules, 34 rule-linked sources, and 4 conflicts                                |
| `pnpm rules:diff --check`                               | Passed: all 63 database rules matched the checked-in catalog                                                             |
| `pnpm audit`                                            | Passed with no known vulnerabilities                                                                                     |
| `pnpm audit --prod`                                     | Passed with no known production vulnerabilities                                                                          |
| `pnpm build`                                            | Passed; production standalone output generated                                                                           |
| Playwright, development server, `--retries=0`           | 39 Chromium tests passed                                                                                                 |
| Playwright, standalone production server, `--retries=0` | 38 Chromium tests passed; the development-only component gallery test was intentionally skipped                          |
| Playwright browser smoke tests, `--retries=0`           | Three WebKit and three Firefox tests passed                                                                              |
| `docker compose build --no-cache`                       | Passed from clean images                                                                                                 |
| Clean Compose initialization                            | Passed; migrations and seed completed before the healthy web service started                                             |

The unit and integration suite covers rule boundaries and conflicts, profile and entity authorization, session and invitation behavior, record and import handling, snapshot recalculation, reminder idempotency, exports and deletion, private document lifecycle, source/rule tooling, operations scripts, and route-level security behavior.

The browser suite covers public/authentication surfaces, registration and onboarding, profile switching, owner-only denial, profile claim and sharing, records, approximate dates, CSV error recovery and duplicate confirmation, private documents, guideline variants, clinician plans, appointments and calendar export, visit prep and print, data export and deletion, offline behavior, dark/reduced-motion behavior, and axe scans of critical pages. The mobile run exercises navigation and contained focus at both 390 px and 320 px.

## Performance baseline

The reproducible clean-database benchmark measured the server data-loading phase for the synthetic household, a dry-run recommendation rebuild, the enforced maximum-size CSV preview, and production artifact sizes. Across seven measured iterations, the release-candidate result recorded 20 SQL statements and a 20.88 ms median for overview data, 12 statements and 9.46 ms for family data, 16.48 ms for a one-profile rebuild preview, and 2,015.71 ms for a 1,000-row CSV preview. The standalone runtime was 53,653,043 bytes and browser JavaScript in static chunks was 1,666,906 bytes. Full methodology, p95 values, scope boundaries, host characteristics, and the exact command are in [performance.md](performance.md).

These loopback measurements are regression baselines, not production service-level guarantees. The artifact sizes were measured from generated production standalone output rather than a development server.

## External source observation

Offline source verification is the release gate and passed without warnings. The explicit live operator check reached the reviewed official URLs and produced no invalid-source errors. Four CDC URLs and one future HRSA URL returned HTTP 403, while two American Cancer Society URLs returned HTTP 406 to the automated probe. These seven responses are recorded as warnings because the sites rejected the automated request; they did not change the checked-in medical rules or cached source metadata. Operators must continue manual source review before publishing a rule change.

An operational MyHealthfinder sync also completed with six live responses and no fallback or failure. Consumer API content remains explanatory only.

## Deployment, persistence, backup, and restore checks

A separate release-verification Compose project was built and started with an empty named volume, non-default loopback ports, generated synthetic secrets, and demo-only records. The following checks passed:

- The initializer ran all committed migrations, seeded once, exited successfully, and could be rerun without changing catalog or demo counts.
- PostgreSQL and web became healthy; readiness, liveness, storage, build-version, CSP, security-header, and request-ID checks passed.
- Both initializer and web ran as UID/GID `1001`.
- A real browser-compatible sign-in redirected to the canonical configured origin and returned the authenticated app.
- Database and upload probes survived web and database restarts.
- Backup produced a 113,501-byte archive containing a non-empty PostgreSQL custom dump, private uploads, a manifest, and verified checksums.
- Data and upload probes added after backup disappeared after restore, while backed-up counts and the synthetic upload SHA-256 returned exactly.
- Restore used the configured Compose project and origin, performed the database replacement in one transaction, reapplied compatible migrations, and required readiness to pass.
- Storage cleanup, rule diff, dry-run recommendation rebuild, and reminder dispatch commands ran successfully inside the deployment. SMTP was intentionally absent, so reminders remained in-app.

The isolated containers, network, volumes, generated secrets, and sensitive temporary backup were removed after verification.

## Security checks

Automated and manual checks confirmed:

- HTTP-only, same-site session cookies, with secure cookies defaulting on in production except an explicit local-HTTP override.
- Opaque HMAC-protected session tokens and server-side revocation.
- Same-origin checks for mutations and canonical-origin redirects.
- Per-request CSP nonces, HSTS and other security headers, bounded request bodies, neutral health responses, and request correlation without health payloads.
- Authorization at household, profile, record, document, recommendation, reminder, and export boundaries.
- Cross-account private-document denial, opaque storage paths, forced attachment download, and no public upload directory.
- Process-local authentication rate limiting, password/session recovery controls, value-free audit events, and static-only service-worker caching.
- Non-root container execution, loopback-only default PostgreSQL publishing, checksummed backup/restore, and production dependency audit.

These controls do not replace TLS termination, host and image patching, unique secret management, encrypted off-site backups, log/access review, malware controls, or a deployment-specific security and compliance assessment.

## Accessibility and responsive checks

Critical public and authenticated pages passed automated axe smoke scans. Browser tests also checked the skip link, accessible form names, visible/contained focus, keyboard navigation, dialog behavior, dark mode, reduced motion, print content, offline explanation, and mobile layouts at 390 px and 320 px. The responsive UI was reviewed at desktop and mobile sizes during complete browser journeys.

Automated checks reduce regressions but do not constitute a formal WCAG conformance audit. A production operator should include assistive-technology and 200% zoom testing in deployment acceptance.

## Demo access

When `DEMO_SEED_ENABLED=true`, the documented synthetic local account is:

- Email: `demo@carecadence.local`
- Password: `carecadence-demo-only`

The seed also creates a second synthetic household used to prove privacy denials. Demo mode and these credentials must remain disabled on any public or real-data deployment.

## Deployment commands

For a loopback-only evaluation:

```bash
cp .env.example .env
# Replace AUTH_SECRET and credentials before sharing the service.
docker compose up --build --wait
curl --fail http://localhost:3000/api/health?mode=readiness
```

For production, first set a canonical HTTPS `APP_BASE_URL`, `SESSION_COOKIE_SECURE=true`, strong unique secrets, `DEMO_SEED_ENABLED=false`, durable storage, and a TLS reverse proxy. Back up with `./scripts/backup.sh ./backups`; restore only after making a separate current backup with `./scripts/restore.sh /secure/path/backup.tar.gz`. Full procedures are in [operations.md](operations.md).

## Known version-one limitations

- Guidance is for adults age 18 and older in the United States. Pediatric and prenatal schedules are not included.
- CareCadence does not diagnose, treat, interpret results, or provide personalized medical clearance. Clinician instructions remain authoritative.
- There is no EHR or pharmacy integration, OCR, or automatic record extraction. Users enter history manually or by CSV.
- Specialty-guideline coverage and modeled individual risks are selective. Rules require ongoing human source review and maintenance.
- External consumer content may temporarily use a clearly dated cached copy; deterministic checked-in rules continue operating.
- Email reminders require complete SMTP configuration and an external scheduler. Self-service email verification and password recovery also require SMTP; a local administrator recovery command remains available without it.
- Uploaded files use operator-managed local private storage, must be included in protected backups, and are not virus-scanned.
- Credentials run through Auth.js; its JWT encode/decode hooks bridge the Credentials provider to opaque, revocable PostgreSQL session records rather than exposing identity claims in the browser token.
- Authentication throttling is process-local. Multiple replicas require a shared trusted edge or centralized limiter.
- The included deployment is single-instance and relies on a correctly configured trusted reverse proxy for forwarded client addresses.
- The project makes no claim of HIPAA compliance and has not undergone a formal clinical, accessibility, penetration, or compliance audit.

## Future opportunities outside version-one scope

Potential later work includes reviewed pediatric or prenatal modules, additional specialty rules and risk models, interoperable EHR/pharmacy import, OCR with explicit review, shared multi-replica throttling and job coordination, object-storage and malware-scanning adapters, self-service recovery, additional identity providers, and formal accessibility/security/compliance assessments. None of these is required for the completed version-one product or implied by this release.
