# Architecture

CareCadence is one self-hosted Next.js application backed by PostgreSQL and a private filesystem volume. The architecture keeps deterministic medical logic separate from persistence, external content, and presentation.

## Runtime boundaries

| Boundary             | Responsibility                                                                                         | Primary paths                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| App Router           | Public pages, authenticated server-rendered pages, route handlers, and focused client interactions     | `src/app`, `src/components`                     |
| Contracts            | Zod-validated request, profile, rule, import, export, and recommendation shapes                        | `src/contracts`                                 |
| Domain               | Pure date arithmetic, rule expressions, schedules, precedence, variants, explanations, and test clocks | `src/domain`                                    |
| Authorization        | Session, household membership, profile grants, capability checks, and neutral denial                   | `src/server/auth`, `src/server/authorization`   |
| Application services | Recommendation rebuilds, imports, exports, reminders, invitations, storage lifecycle, and read models  | `src/server`                                    |
| Persistence          | Prisma schema, focused repositories, migrations, and seed catalogs                                     | `prisma`, `src/server/repositories`             |
| Operations           | Compose initialization, health checks, source tools, backup/restore, cleanup, and cron entry points    | `compose.yaml`, `scripts`, `docs/operations.md` |

The web process does not need an external queue, object store, or source API for core operation. SMTP and MyHealthfinder enrichment are optional.

## Request and authorization flow

1. The proxy creates a per-request CSP nonce and protects `/app` routes that have no session cookie.
2. The authenticated layout validates the opaque cookie against its HMAC digest and unexpired PostgreSQL session record.
3. Page and route code resolves household or profile access on the server. A household role alone does not reveal a claimed adult profile.
4. Entity queries include the authorized profile or household key. A document, event, medication, reminder, plan, or override ID is never accepted as authorization evidence by itself.
5. Unauthorized and unknown profile resources use the same not-found response. Route handlers return neutral structured errors; pages use the neutral App Router not-found screen.
6. State-changing requests require a matching Origin and trusted host. Client components can hide unavailable controls, but server authorization remains authoritative.

Passwords use Argon2id through the Auth.js Credentials provider. Auth.js Credentials requires its JWT strategy, so custom encode/decode hooks bridge that lifecycle to opaque database sessions: the cookie contains only a random token, while PostgreSQL stores its HMAC digest, expiry, and user relationship. Password changes, recovery, sign-out, and account deletion revoke applicable server-side sessions.

When SMTP is complete, registration issues a hashed, single-use email-verification token and email-bound invitation acceptance requires verified ownership. Password-reset links use separate one-hour single-use tokens and revoke every session when completed. Requests and responses remain neutral about account existence. Without SMTP, local self-hosted registration remains available and password recovery is an explicit administrator command.

## Health-data model

`Household` and `HouseholdMember` describe account collaboration. `Profile` is the privacy boundary for health data. Ownership, visibility, and explicit `ProfileAccessGrant` rows determine view, edit, manage, export, and deletion capabilities.

Profile context is normalized into anatomy, risks, conditions, family history, surgeries, medications, care events, history assertions, clinician overrides, and guideline selections. Date-only facts use PostgreSQL `DATE`. Approximate history stores a start/end range plus precision rather than inventing a day. Appointments and reminder delivery times use timezone-aware timestamps and retain the profile timezone for display and scheduling.

Guidelines use separate source, service, method, and immutable rule-version records. Recommendation instances are snapshots: changed calculations retire the prior row and create a new one, while identical calculation hashes remain unchanged. Planned actions and reminders refer to snapshots without changing medical due ranges.

See `prisma/schema.prisma` for the complete relational schema and `docs/privacy-model.md` for data sensitivity and trust assumptions.

## Recommendation flow

1. A workflow loads a profile and its normalized context for an explicit local `asOfDate`.
2. Active, reviewed, source-backed rules are converted from validated JSON expression trees into domain inputs. No database rule executes JavaScript.
3. The pure evaluator applies eligibility, exclusions, stop conditions, event qualification, uncertainty propagation, schedule math, guideline selection, and clinician-override precedence.
4. Each result contains status, medical due range, source/rule version, matching facts, explanation tokens, limitations, and a deterministic calculation hash.
5. The repository synchronizes active snapshots transactionally. Downstream pages read snapshots; they do not recalculate medical logic in React.

Care-event, profile-context, variant, and clinician-plan mutations rebuild recommendations in the same database transaction as the triggering change. A failed rebuild rolls the mutation back.

## Guideline variants and personal plans

Rules that answer the same question share a conflict group. One active baseline variant may contain multiple non-overlapping segments. Specialty alternatives remain separate, labeled choices. Selecting a variant changes which reviewed rule organizes the plan; it does not merge guidance or claim clinical truth.

Clinician overrides remain separate records with provenance, personal timing, and active, paused, or ended state. Editing creates a new row and ends the prior version so instruction history is retained. General guidance stays available as context while an instruction is paused. Custom maintenance entries are user- or clinician-chosen cadences and are explicitly not universal guideline deadlines.

## External source flow

The checked-in source registry is the provenance authority for executable rules. Offline verification checks identifiers, HTTPS URLs, dates, source/rule references, conflicts, and review state. Live verification is an explicit operator check.

MyHealthfinder requests never include profile data. Responses are size-bounded, validated, sanitized, hashed, and cached as consumer explanation content. A changed hash waits for review, and stale cached text is labeled. External text cannot alter eligibility, status, or due dates.

## Private document flow

Uploads enter a route handler that authenticates edit access, enforces the byte limit, checks the file signature rather than trusting the supplied MIME type, assigns an opaque storage key, and writes outside `public/`. Metadata and optional event links are then committed in PostgreSQL.

Downloads re-authorize the linked profile and use a safe attachment filename. Deletion first makes the record unavailable, then removes the blob. If storage deletion fails, `pnpm storage:cleanup` retries idempotently and records `blobDeletedAt` only after the bytes are gone or already absent. Exports include only currently authorized data and documents whose integrity checks pass.

## Reminders and calendar

Reminder candidates are generated from eligible recommendation and planning states, explicit profile-visible custom-maintenance dates, medication review dates, and clinician-plan review dates with stable dedupe keys and profile-local time conversion. Owner-only custom items remain out of the profile-wide reminder feed. Appointment reminders are created only from a user-selected offset or reminder time; an exact appointment alone never opts the user in. Refreshing candidates preserves snoozed and dismissed rows, while obsolete personal-date prompts are removed. Generated personal-review records stay in app and contain no medication names, maintenance titles, clinician instructions, or diagnosis details; an authorized clinician-plan view may resolve its personal instruction through the linked recommendation. In-app reminders work without SMTP. Email dispatch uses neutral text, database advisory locks, and idempotent status transitions so concurrent or repeated cron runs do not send twice.

The calendar keeps medical ranges, user plans, appointments, reminders, and custom cadences visually and semantically distinct. Saving a month or appointment never changes a recommendation's source-backed timing. ICS exports require export capability at request time.

## Deletion, export, and audit

Profile and household exports are assembled server-side after current authorization checks. CSV cells are escaped against spreadsheet formulas, and ZIP manifests describe the generated files. Deletion cancels pending reminders, soft-deletes ordinary health records, schedules private-blob removal, and writes minimal audit events. Backups remain separate sensitive copies governed by operator retention.

Audit metadata contains identifiers, action classes, and counts rather than health payloads. Application code must not log request bodies, diagnoses, medication names, filenames, reminder text, exports, or raw source responses.

## Offline and caching

The service worker caches only the public offline shell and fixed public assets. It never caches authenticated HTML, `/api` responses, documents, exports, or profile data. PostgreSQL remains the source of truth; private pages require a live connection.

## Deployment shape

Compose runs:

- `db`: PostgreSQL with a durable volume and loopback-only host binding.
- `init`: a non-root one-shot image that applies committed migrations and idempotent seed data.
- `web`: a non-root standalone Next.js image with the shared durable private-upload volume.

The web health check verifies PostgreSQL and a temporary storage probe. A TLS reverse proxy is responsible for canonical forwarding headers, request-size limits, and rejecting spoofed client forwarding headers. Backup and restore cover both durable volumes.

## Verification strategy

Pure unit and rule-scenario tests exercise medical logic without a database. PostgreSQL integration tests cover constraints, transactions, snapshot synchronization, and repeated demo seeding. Route/component tests cover authorization and client behavior. Playwright runs the core household, privacy, records, variants, clinician-plan, import, document, data-rights, offline, mobile, and accessibility journeys against the production build. CI then verifies an empty migration path, repeated seed, source structure, build, and browser suite.
