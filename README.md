# CareCadence

## 1. What CareCadence is

CareCadence is a self-hosted, multi-profile preventive-care organizer for adults in the United States. It turns versioned guideline rules and recorded history into explainable care-plan snapshots, timelines, planning views, reminders, and visit-prep material.

## 2. Medical and privacy disclaimer

CareCadence is educational organization software. It does not diagnose, treat, interpret results, provide medical clearance, or replace a clinician. Guidance can change and personal circumstances can differ. Clinician instructions remain authoritative.

Profiles, documents, exports, and backups contain sensitive health data. A household role does not override a claimed adult profile's privacy. This project does not claim HIPAA compliance. Read [the privacy and threat model](docs/privacy-model.md) before deployment.

## 3. Feature summary

- Household accounts with explicitly shared or owner-only adult profiles.
- Guided onboarding for demographics, relevant anatomy, risks, conditions, medications, and history.
- Deterministic, source-linked recommendations with guideline comparison and clinician overrides.
- Records, approximate dates, CSV import, private documents, timeline, annual calendar, and visit prep.
- In-app reminders, optional SMTP identity/recovery and reminder mail, data export/deletion, source freshness, and rule maintenance.
- Static-only offline shell; authenticated health data is deliberately not cached.

## 4. Screens and routes

| Area                                 | Route                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Public, register, sign in, recovery  | `/`, `/register`, `/sign-in`, `/forgot-password`, `/reset-password`    |
| Overview and onboarding              | `/app`, `/app/onboarding`                                              |
| Care plan and recommendation detail  | `/app/profile/:profileId/care-plan`                                    |
| Records, backfill, and CSV import    | `/app/profile/:profileId/records`                                      |
| Timeline and calendar                | `/app/profile/:profileId/timeline`, `/app/profile/:profileId/calendar` |
| Medications, sharing, and visit prep | `/app/profile/:profileId/medications`, `/sharing`, `/visit-prep`       |
| Family, reminders, and settings      | `/app/family`, `/app/reminders`, `/app/settings`                       |

## 5. Architecture

Next.js 16 and React 19 render server-first pages with focused client interactions. PostgreSQL 18 stores identity, database-backed sessions, health context, source/rule versions, and recommendation snapshots through Prisma 7. Private uploads live outside `public/` behind authenticated handlers. A pure TypeScript rule engine evaluates normalized local-date facts. Docker Compose supplies PostgreSQL, one-shot migration/seed initialization, and a minimal non-root standalone web image.

See [the architecture guide](docs/architecture.md) for request, authorization, rule-evaluation, source, storage, reminder, and deployment flows.

## 6. Prerequisites

- Node.js 22 or newer and pnpm 11.9 for host development.
- Docker Engine with Compose v2 for PostgreSQL or the full stack.
- Chromium dependencies installed by Playwright for browser tests.
- Optional SMTP server for email verification, password reset, and reminders; no paid service is required.

## 7. Quick start

```bash
cp .env.example .env
docker compose up -d db
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.example` enables synthetic demo data for local use. Replace its example secret before sharing the service.

## 8. Local development

`./scripts/dev.sh` runs the quick-start sequence and starts Next.js. It creates `.env` only when absent and never overwrites one. Common commands are `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 9. Docker start

```bash
cp .env.example .env
# Edit AUTH_SECRET and credentials.
docker compose up --build --wait
```

Compose applies migrations and seed catalogs before web starts. PostgreSQL is bound only to `127.0.0.1`; remove even that mapping on a remote host if host-side database tools are unnecessary.

## 10. Environment configuration

All variables, safe local examples, production guidance, and data/session effects are documented in [docs/operations.md](docs/operations.md#environment-reference). Never commit `.env`.

## 11. Database migration

Use `pnpm db:migrate` only to develop a migration. Use `pnpm db:migrate:deploy` in a release. Compose performs deploy migrations in its `init` service. Test migrations against an empty database and a restored copy before production.

## 12. Seed and demo credentials

`pnpm db:seed` idempotently installs the reviewed source, service, method, and rule catalog. With `DEMO_SEED_ENABLED=true`, it also creates synthetic profiles. Local defaults are `demo@carecadence.local` / `carecadence-demo-only`; never use those credentials or demo mode for a public deployment.

With SMTP configured, new accounts confirm email ownership and can use the self-service password-reset flow. Email-bound invitation acceptance requires a confirmed address. If SMTP recovery is unavailable, an administrator with local database access can run `pnpm account:recover -- --email user@example.com`. The command prompts for a new password without echoing it, revokes every existing session, and writes a value-free audit event. Non-interactive operators can use `--password-file` with an owner-only (`0600`) file or `--password-stdin`; never place a password directly in command arguments.

## 13. Tests

```bash
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

CI supplies PostgreSQL, migrates an empty database, seeds fixtures, runs offline source verification, builds, starts the production app, and runs Playwright. Failure reports are archived. CI never contacts live medical-source sites.

The exact version-one gate results, catalog counts, deployment smoke checks, and limitations are recorded in [the release report](docs/release-report.md).

Production artifact size, overview/family SQL counts, profile-rebuild timing, and the maximum-row import-preview timing are reproducible with `pnpm exec tsx scripts/benchmark-release.ts`; see [the performance report](docs/performance.md).

## 14. Source verification

`pnpm sources:verify` validates checked-in structure without a network request. `pnpm sources:verify --live` is an explicit operator check. See [the source register](docs/source-register.md) for provenance and current-version decisions.

## 15. Rule maintenance

Run `pnpm rules:validate` and `pnpm rules:diff --from <old> --to <new>`. Record changed cached-content decisions with `pnpm sources:review`, add a new immutable rule version when medical logic changes, preview affected snapshots with `pnpm recommendations:rebuild --rule <stable-key> --dry-run`, then rebuild and run the full tests. Consumer API content may explain a recommendation but never controls eligibility or timing. The complete commands are in [the maintenance guide](docs/medical-rule-maintenance.md).

## 16. Reminder cron

`pnpm reminders:dispatch` is the idempotent dispatch command. A safe daily cron example and the container form are in [the operations guide](docs/operations.md#scheduling). Email is optional; without SMTP, in-app reminders still work.

## 17. Backup

`./scripts/backup.sh ./backups` captures PostgreSQL, the private upload volume, and a checksummed version manifest. It briefly stops web writes for consistency. Encrypt and move the resulting archive to restricted storage. Details are in [the operations guide](docs/operations.md#backup).

## 18. Restore

Create a separate current backup, then run `./scripts/restore.sh /secure/path/backup.tar.gz`. Restore requires a typed destructive confirmation, replaces database and files, applies compatible migrations, and verifies readiness. See [restore procedures](docs/operations.md#restore).

## 19. Updating

Back up, review release and migration notes, pull the intended version, run `docker compose build --pull`, then `docker compose up -d --wait`. Avoid unattended major-version upgrades. Verify `/api/health?mode=readiness` and core household access afterward.

## 20. Security notes

The app uses Argon2id passwords, HMAC-protected opaque session tokens stored only in HTTP-only cookies, server-side session records, same-origin mutation checks, per-request nonce CSP, security headers, authorization at household/profile/entity boundaries, opaque private storage keys, content sniffing, and neutral health responses. Production still requires TLS, unique secrets, host patching, encrypted backups, and access review. See [docs/privacy-model.md](docs/privacy-model.md).

## 21. Data export and deletion

Profile and household exports are initiated from **Settings → Data** and require current authorization. Deletion is confirmed and audited. Exports and retained backups are independent sensitive copies; operators must apply their published backup-retention policy when a user requests deletion.

## 22. Deployment example

Run Compose on a maintained Linux host behind a TLS reverse proxy, with `SESSION_COOKIE_SECURE=true`. Publish only `${APP_PORT}`, forward the original host and scheme, keep PostgreSQL and Docker private, mount durable named volumes, schedule encrypted backups and reminder dispatch, and monitor the readiness endpoint. No external source sync or SMTP service is required for core operation.

## 23. Troubleshooting

- `init` exits: inspect `docker compose logs init db` and correct migration or credentials; do not reset the volume.
- Readiness is `503`: its neutral `checks` field identifies database or storage; inspect restricted server logs for detail.
- Login fails after secret rotation: existing sessions were intentionally invalidated; sign in again.
- Upload fails: align reverse-proxy body limits and `MAX_UPLOAD_BYTES`, then check volume ownership and free space.
- Source content is stale: deterministic rules still work; run the explicit operator verification workflow.

More recovery steps are in [docs/operations.md](docs/operations.md#failure-recovery).

## 24. Known limitations

- Version one covers U.S. guidance for adults age 18 and older. It does not provide pediatric or prenatal schedules.
- CareCadence does not diagnose, treat, interpret results, provide personalized medical clearance, or replace clinical judgment. Clinician instructions remain the authoritative personal plan.
- There is no EHR or pharmacy integration, OCR, or automatic record extraction. History entry is manual or CSV.
- Specialty-guideline coverage and modeled individual risks are intentionally selective. Guideline rules require human review and maintenance, and external consumer content may temporarily use a labeled cached copy.
- Email verification and self-service password reset require a complete SMTP configuration. Email reminders additionally require an external scheduler. Without SMTP, the local administrator recovery command remains available.
- Uploaded files use local private storage, require operator backup, and are not virus-scanned.
- Credentials are authenticated through Auth.js with Argon2id. Because the Auth.js Credentials provider requires JWT strategy, its encode/decode hooks bridge to opaque, revocable PostgreSQL session records rather than storing identity data in a browser-readable token.
- Authentication rate limits are bounded and process-local. A multi-replica deployment needs a trusted proxy or shared limiter, and the included single-instance deployment must accept forwarded client IP headers only from its trusted proxy.
- The project makes no claim of HIPAA compliance. No paid runtime dependency is required.

Never include health details, exports, documents, credentials, or backup contents in a support report.
