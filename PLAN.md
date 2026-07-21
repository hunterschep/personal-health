# CareCadence — All-Encompassing Build Plan

**Status:** Normative implementation plan  
**Companion brief:** `goal.md`  
**Product:** CareCadence  
**Version-one market:** United States, adults age 18 and older  
**Delivery mode:** One-pass, complete, production-ready build  
**Primary architecture:** Self-hostable Next.js monolith with a deterministic medical rules engine

---

## 0. How to use this plan

This file is the execution contract for every implementation agent.

`goal.md` defines the compact product outcome. This file defines the architecture, ownership, sequencing, interfaces, tests, and acceptance criteria required to reach that outcome without another planning round.

Every agent must:

1. Read `goal.md`.
2. Read this plan.
3. Read the contracts and files owned by prerequisite parts.
4. Work only inside the paths assigned to the part unless a shared-contract change is essential.
5. Implement real behavior, real validation, real persistence, and real tests.
6. Use synthetic data in fixtures, screenshots, demos, and tests.
7. Avoid TODO comments, placeholder pages, fake buttons, and unhandled empty states.
8. Add or update the part handoff in `docs/handoffs/`.
9. Run the part-specific verification commands.
10. Leave the repository in a mergeable state.

The lead/integration agent is responsible for:

- Locking shared contracts before parallel work begins.
- Resolving merge conflicts.
- Preventing duplicate implementations.
- Running full-system validation.
- Fixing integration failures.
- Confirming every acceptance criterion.
- Producing the final implementation summary and limitations list.

No agent should stop merely because a requirement is ambiguous. Apply the defaults in this plan, choose the safer and simpler production-quality interpretation, document the decision, and continue.

---

## 1. Product north star

CareCadence answers one practical question for every profile:

> What preventive health action should this person consider next, why, and based on which source?

The app should make preventive care understandable without pretending to diagnose, prescribe, or replace a clinician.

The complete experience must let a user:

- Create a private household.
- Add multiple adult profiles.
- Capture only the profile data needed to personalize preventive guidance.
- Receive an immediate source-backed care plan.
- See current, annual, and future care needs.
- Understand uncertainty and guideline disagreement.
- Backfill exact and approximate history.
- Record completed care.
- Add clinician-specific schedules.
- Plan appointments and reminders.
- Prepare for a doctor visit.
- Inspect every source and calculation.
- Keep private adult profiles private.
- Export and delete their data.

The interface must feel like a calm personal health command center rather than a hospital portal, spreadsheet, or gamified task tracker.

---

## 2. Non-goals and hard boundaries

Version one does not include:

- Symptom diagnosis.
- Emergency triage.
- Treatment recommendations.
- Medication dosing.
- Drug-interaction advice.
- Clinical interpretation of laboratory values.
- Pediatric guidance.
- Prenatal care plans.
- Insurance coverage estimates.
- Billing or claims.
- EHR integrations.
- Pharmacy integrations.
- Automatic OCR.
- Automatic extraction from medical documents.
- Autonomous medical rule generation.
- LLM-driven eligibility or due dates.
- A universal annual blood-panel recommendation.
- A health score.
- Claims of HIPAA compliance.

The app may store an abnormal, positive, inconclusive, or otherwise non-routine result, but it must not interpret that result. It should move the service into clinician-managed status and invite the user to record the clinician's follow-up plan.

---

## 3. Immutable product decisions

These decisions remove ambiguity for implementation agents.

### 3.1 Stack

Use:

- Next.js App Router.
- Strict TypeScript.
- pnpm.
- Tailwind CSS.
- shadcn/ui.
- Lucide icons.
- React Hook Form.
- Zod.
- date-fns.
- PostgreSQL.
- Prisma ORM.
- Auth.js credentials authentication.
- Argon2id password hashing.
- Vitest.
- Playwright.
- Testing Library.
- Docker.
- Docker Compose.
- A local private file-storage adapter backed by a Docker volume.
- An optional SMTP adapter.
- A PWA manifest and static-shell service worker.

Select current stable, mutually compatible package versions at implementation time and commit the lockfile. Do not use experimental framework features when a stable approach exists.

### 3.2 Application shape

Build one deployable web application, not microservices.

Use:

- Server Components for read-heavy authenticated pages.
- Client Components only where interaction requires them.
- Server Actions for ordinary authenticated form mutations.
- Route Handlers for uploads, downloads, CSV preview/commit, exports, health checks, calendar files, source sync, and optional reminder dispatch.
- A service layer for authorization and transactions.
- A pure domain layer for medical rule evaluation.

### 3.3 Medical logic

Medical logic must be:

- Deterministic.
- Versioned.
- Source-backed.
- Serializable.
- Unit tested.
- Independent of UI and database access.
- Evaluated against an explicit `asOfDate`.
- Able to explain its result.

No rule may execute arbitrary JavaScript stored in the database. Conditions must use a validated expression tree.

### 3.4 Privacy

An adult profile may be:

- Visible only to its owning user.
- Shared with selected household members.
- Shared with the whole household.

Household membership alone does not automatically grant access to every adult profile.

A parent or household organizer may create an unclaimed profile. An invited adult can later claim it and choose its privacy settings.

### 3.5 Guideline variants

Conflicting reputable sources remain separate variants.

The default evidence-based plan prioritizes federal preventive guidance. Specialty recommendations appear as labeled alternatives. The user may select a variant for a conflict group, and a clinician override may supersede both.

### 3.6 Date precision

Store historical timing as ranges:

- Exact day.
- Month.
- Year.
- Unknown date.

Never invent precision. Every schedule calculation must propagate uncertainty.

### 3.7 PWA behavior

Cache only public/static application shell assets.

Do not cache authenticated HTML, profile data, API responses, document downloads, source payloads containing user-specific context, or exports in the service worker.

When offline, show a safe offline shell and explain that private health data is unavailable until the connection returns.

### 3.8 Email behavior

The product must work without SMTP.

In-app reminders are always available. Email delivery activates only when SMTP variables are configured. Reminder dispatch must be an idempotent command suitable for cron rather than a mandatory queue service.

---

## 4. Definition of done

The build is complete only when:

- A clean checkout installs successfully.
- Docker Compose starts PostgreSQL and the web app.
- Migrations run on an empty database.
- Seed data creates a usable synthetic demo.
- Registration and sign-in work.
- Household and profile management work.
- The rules engine generates a plan.
- The plan updates immediately after relevant data changes.
- Backfill, bulk entry, and CSV import work.
- Source citations and variants work.
- Clinician overrides work.
- Timeline, calendar, family, medications, records, reminders, sources, and settings work.
- Attachments are private.
- Visit preparation prints cleanly.
- Profile and household exports work.
- Deletion works.
- Authorization boundaries are tested.
- Empty, loading, error, offline, and mobile states are implemented.
- Lint passes.
- Formatting passes.
- Type checking passes.
- Unit tests pass.
- Integration tests pass.
- End-to-end tests pass.
- The production build passes.
- The README contains exact setup and operations commands.
- The rule-maintenance guide is complete.
- No core TODOs or placeholder implementations remain.

---

## 5. Agent operating model

### 5.1 Roles

Use the following logical roles even when one physical agent performs multiple parts:

- **Lead/Integrator:** architecture, contracts, sequencing, final integration.
- **Foundation Agent:** repository, design system, app shell, infrastructure.
- **Data Agent:** schema, migrations, repositories, transactions, seed framework.
- **Identity Agent:** authentication, household membership, invites, profile access.
- **Sources Agent:** source registry, external content sync, attribution, stale checks.
- **Rules Authoring Agent:** DSL schema and reviewed seed rules.
- **Rules Engine Agent:** pure evaluator, due-date math, explanations, tests.
- **Profile Agent:** onboarding, risk capture, profile editing.
- **Records Agent:** care events, guided backfill, bulk entry, CSV import.
- **Care Plan Agent:** overview, cards, recommendation details, source comparison.
- **Planning Agent:** timeline, annual roadmap, calendar, reminders.
- **Family Agent:** household dashboard, sharing, claiming, privacy-aware activity.
- **Clinical Context Agent:** medications, clinician overrides, custom maintenance.
- **Documents Agent:** private uploads, exports, print agenda, calendar files.
- **Quality Agent:** security, accessibility, tests, CI, operational docs.

### 5.2 Shared-contract rule

Only the Lead/Integrator owns these files after the contracts are frozen:

- `src/contracts/**`
- `src/domain/shared/**`
- `src/config/**`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `eslint.config.*`
- `vitest.config.*`
- `playwright.config.*`
- `prisma/schema.prisma`
- Root Docker and CI files

Agents may propose a contract change in their handoff. The Lead/Integrator applies the change and updates dependent code.

### 5.3 File ownership rule

Each part below lists owned paths.

An agent may read any path but should avoid editing outside owned paths. Shared visual primitives go through the Foundation Agent. Shared database changes go through the Data Agent. Shared domain contract changes go through the Lead/Integrator.

### 5.4 Handoff format

Every part must create:

`docs/handoffs/part-XX-short-name.md`

The handoff must contain:

- Scope completed.
- Files added or changed.
- Public contracts introduced.
- Database changes.
- Tests added.
- Commands run.
- Known integration considerations.
- Remaining limitations.
- Confirmation that no core TODOs remain.

### 5.5 Commit discipline

Use one intentional commit per completed part where practical.

Commit messages:

`part XX: concise outcome`

Do not commit:

- Secrets.
- Real health data.
- Generated upload contents.
- Local database files.
- Playwright traces unless intentionally retained as an artifact.
- Unreviewed source snapshots.
- Broken migrations.

---

## 6. Parallelization and dependency graph

### Wave 0 — Contracts and scaffold

Run sequentially:

- Part 00: Lead contracts and repository skeleton.
- Part 01: Foundation and design system.
- Part 02: Database schema and seed framework.

### Wave 1 — Independent domain foundations

Run in parallel after Wave 0:

- Part 03: Authentication, household, and profile privacy.
- Part 04: Source registry and external content cache.
- Part 05: Rule DSL and authoring tools.
- Part 06: Service catalog and initial guideline rules.

Part 06 depends on Part 05 contracts but can begin with frozen schemas and fixtures.

### Wave 2 — Core behavior

Run in parallel after relevant Wave 1 contracts:

- Part 07: Deterministic evaluator.
- Part 08: Recommendation persistence and recalculation.
- Part 09: Profile onboarding and editing.
- Part 10: Care history and backfill.

### Wave 3 — Main product surfaces

Run in parallel after Parts 07–10 expose stable services:

- Part 11: Overview and care-plan details.
- Part 12: Timeline, annual roadmap, and calendar.
- Part 13: Family dashboard, sharing, and claiming.
- Part 14: Medications, clinician overrides, and custom maintenance.
- Part 15: Documents, visit agenda, and exports.
- Part 16: Reminder center and optional email.

### Wave 4 — Transparency and hardening

Run after main surfaces exist:

- Part 17: Sources center and rule-maintenance operations.
- Part 18: Security, privacy, accessibility, and performance hardening.
- Part 19: Full automated test matrix.
- Part 20: Docker, CI, backup, restore, and deployment docs.

### Wave 5 — Integration

Run sequentially:

- Part 21: Full-system integration, demo polish, release verification.

### Critical path

The critical path is:

`00 → 02 → 05 → 06 → 07 → 08 → 11 → 19 → 21`

No UI agent should reimplement eligibility logic. No rules agent should write UI-specific status logic. No data agent should encode medical intervals in migrations or seed helpers outside the rule model.

## 7. Target repository layout

Use this layout unless the existing repository has an equivalent structure:

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── architecture.md
│   ├── medical-rule-maintenance.md
│   ├── privacy-model.md
│   ├── operations.md
│   ├── source-register.md
│   └── handoffs/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── index.ts
│       ├── sources.ts
│       ├── services.ts
│       ├── rules.ts
│       └── demo.ts
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   ├── offline.html
│   └── sw.js
├── scripts/
│   ├── verify-sources.ts
│   ├── sync-myhealthfinder.ts
│   ├── rebuild-recommendations.ts
│   ├── dispatch-reminders.ts
│   ├── backup.sh
│   └── restore.sh
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (app)/
│   │   ├── api/
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── loading.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── shell/
│   │   ├── profile/
│   │   ├── care-plan/
│   │   ├── records/
│   │   ├── timeline/
│   │   ├── family/
│   │   ├── medications/
│   │   ├── sources/
│   │   └── shared/
│   ├── contracts/
│   │   ├── auth.ts
│   │   ├── profile.ts
│   │   ├── rules.ts
│   │   ├── care-events.ts
│   │   ├── recommendations.ts
│   │   ├── imports.ts
│   │   └── exports.ts
│   ├── domain/
│   │   ├── rules/
│   │   │   ├── expression.ts
│   │   │   ├── evaluator.ts
│   │   │   ├── schedule.ts
│   │   │   ├── status.ts
│   │   │   ├── explanations.ts
│   │   │   └── index.ts
│   │   ├── dates/
│   │   ├── privacy/
│   │   └── shared/
│   ├── server/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── authorization/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── storage/
│   │   ├── email/
│   │   ├── sources/
│   │   └── audit/
│   ├── styles/
│   └── test/
│       ├── factories/
│       ├── fixtures/
│       ├── integration/
│       └── setup.ts
├── tests/
│   └── e2e/
├── uploads/
│   └── .gitkeep
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── README.md
└── goal.md
```

The authenticated route structure should include:

```text
/app
/app/onboarding
/app/family
/app/family/invites
/app/profile/[profileId]
/app/profile/[profileId]/care-plan
/app/profile/[profileId]/timeline
/app/profile/[profileId]/calendar
/app/profile/[profileId]/records
/app/profile/[profileId]/records/backfill
/app/profile/[profileId]/records/import
/app/profile/[profileId]/medications
/app/profile/[profileId]/visit-prep
/app/profile/[profileId]/sharing
/app/sources
/app/settings
/app/settings/security
/app/settings/data
```

Use readable server-side redirects for invalid or inaccessible profile IDs. Never reveal whether an unauthorized profile exists.

---

## 8. Cross-cutting domain contracts

Part 00 must freeze these contracts early so agents can work in parallel.

### 8.1 Date precision

```ts
export type DatePrecision = "day" | "month" | "year" | "unknown";

export type DateRange = {
  start: string | null; // ISO date, inclusive
  end: string | null;   // ISO date, inclusive
  precision: DatePrecision;
};
```

Rules:

- `day`: start equals end.
- `month`: start is first day; end is last day.
- `year`: start is January 1; end is December 31.
- `unknown`: start and end are null.
- Never silently convert `unknown` to a guessed date.
- Persist the user-entered display value separately only when needed for audit; calculations use the normalized range.

### 8.2 Recommendation status

```ts
export type RecommendationStatus =
  | "future"
  | "up_to_date"
  | "due_this_year"
  | "due_soon"
  | "due_now"
  | "overdue"
  | "unknown_history"
  | "needs_date_confirmation"
  | "discuss_with_clinician"
  | "clinician_managed"
  | "not_routinely_recommended"
  | "not_applicable"
  | "completed_once";
```

### 8.3 Recommendation class

```ts
export type RecommendationClass =
  | "routine"
  | "shared-decision"
  | "selective"
  | "insufficient-evidence"
  | "not-recommended"
  | "custom-maintenance";
```

### 8.4 Evidence mode

```ts
export type CarePlanMode =
  | "evidence_based"
  | "extra_attentive"
  | "clinician_plan";
```

`clinician_plan` is not a global replacement for all guidance. It indicates that active personal overrides should be emphasized. Rules without overrides still use the evidence-based baseline plus any explicitly selected variants.

### 8.5 Anatomy

```ts
export type AnatomyKey =
  | "cervix"
  | "breast_tissue"
  | "prostate"
  | "uterus"
  | "ovaries";

export type AnatomyState =
  | "present"
  | "absent"
  | "unknown"
  | "prefer_not_to_answer";
```

Unknown anatomy should not be treated as absent. If a rule depends on an unknown anatomy field, generate a profile-information prompt rather than an inapplicable status.

### 8.6 Care event result

```ts
export type CareEventResult =
  | "normal"
  | "abnormal"
  | "inconclusive"
  | "unknown"
  | "not_applicable";
```

### 8.7 Care event source

```ts
export type CareEventSource =
  | "user_memory"
  | "medical_record"
  | "clinician"
  | "pharmacy"
  | "csv_import";
```

### 8.8 Guideline variant selection

Each conflict group can have at most one active selected variant per profile.

If no profile selection exists:

- Use the configured federal baseline variant.
- Show specialty variants as comparisons in Extra-attentive mode.
- Do not calculate multiple active due dates for the same conflict group.

### 8.9 Authorization result

All service-layer authorization helpers return either:

```ts
type Authorized<T> = { ok: true; value: T };
type Denied = { ok: false; reason: "not_found" | "forbidden" };
```

At the HTTP boundary, both missing and forbidden private resources should normally produce the same not-found response.

### 8.10 Explanation token

The engine must return structured explanations rather than preformatted UI paragraphs:

```ts
type ExplanationToken = {
  code: string;
  label: string;
  value?: string | number | boolean | null;
  sourceFact?: string;
};
```

Examples:

- `age_in_range`
- `anatomy_present`
- `ever_smoked`
- `pack_year_threshold_met`
- `quit_window_met`
- `last_event_method`
- `last_event_date_exact`
- `last_event_date_approximate`
- `clinician_override_active`
- `selected_guideline_variant`
- `abnormal_history_requires_follow_up`

The UI translates these into respectful plain language.

---

## 9. Database architecture and domain model

Use PostgreSQL-native constraints and Prisma migrations.

### 9.1 Identity tables

#### `User`

Required fields:

- `id`
- `email`
- `emailNormalized`
- `passwordHash`
- `name`
- `emailVerifiedAt`, nullable
- `lastLoginAt`, nullable
- `sessionVersion`
- `createdAt`
- `updatedAt`
- `deletedAt`, nullable

Constraints:

- Unique normalized email.
- Exclude soft-deleted users from ordinary auth.
- Increment `sessionVersion` to invalidate all sessions.

#### Auth.js session tables

Use database sessions.

Include the standard session and verification-token fields required by the chosen Auth.js adapter. Credentials authentication remains the primary sign-in method.

### 9.2 Household tables

#### `Household`

- `id`
- `name`
- `ownerUserId`
- `timezone`
- `countryCode`
- `createdAt`
- `updatedAt`
- `deletedAt`

#### `HouseholdMember`

- `id`
- `householdId`
- `userId`
- `role`: `owner | admin | member`
- `joinedAt`
- `removedAt`
- Unique active membership per user and household.

#### `HouseholdInvite`

- `id`
- `householdId`
- `emailNormalized`
- `role`
- `tokenHash`
- `expiresAt`
- `acceptedAt`
- `revokedAt`
- `invitedByUserId`
- `createdAt`

Never store a raw invite token after issuance.

### 9.3 Profile tables

#### `Profile`

- `id`
- `householdId`
- `ownerUserId`, nullable for unclaimed profiles
- `createdByUserId`
- `displayName`
- `relationshipLabel`
- `dateOfBirth`
- `sexAssignedAtBirth`: `female | male | intersex | unknown | prefer_not_to_answer`
- `genderIdentity`, nullable free text with length limit
- `countryCode`
- `timezone`
- `carePlanMode`
- `visibility`: `owner_only | selected_members | household`
- `claimedAt`, nullable
- `createdAt`
- `updatedAt`
- `deletedAt`

#### `ProfileAccessGrant`

- `id`
- `profileId`
- `userId`
- `permission`: `view | edit | manage`
- `grantedByUserId`
- `createdAt`
- Unique grant per profile/user.

The profile owner always has `manage`. Household owner status does not bypass `owner_only` visibility for a claimed adult profile.

#### `ProfileClaimInvite`

- `id`
- `profileId`
- `emailNormalized`
- `tokenHash`
- `expiresAt`
- `acceptedAt`
- `revokedAt`
- `createdByUserId`
- `createdAt`

### 9.4 Health-context tables

#### `ProfileAnatomy`

- `id`
- `profileId`
- `anatomyKey`
- `state`
- `effectiveDate`, nullable
- `note`, nullable
- Unique current row per profile/anatomy key.

#### `RiskFactor`

- `id`
- `profileId`
- `type`
- `valueJson`
- `startedAt`, nullable
- `endedAt`, nullable
- `source`
- `createdAt`
- `updatedAt`
- `deletedAt`

Use typed Zod contracts for known risk-factor payloads. Do not accept arbitrary unvalidated JSON from the client.

Seed supported types such as:

- `tobacco_use`
- `height_weight`
- `pregnancy_status`
- `immunocompromised`
- `alcohol_use`
- `fall_risk`
- `sexual_health_risk`
- `occupational_exposure`

#### `Condition`

- `id`
- `profileId`
- `code`
- `displayName`
- `status`: `active | resolved | history`
- `diagnosedDateRange`
- `note`
- `createdAt`
- `updatedAt`
- `deletedAt`

#### `FamilyHistory`

- `id`
- `profileId`
- `relationship`
- `conditionCode`
- `conditionDisplay`
- `ageAtDiagnosis`, nullable
- `note`
- `createdAt`
- `updatedAt`
- `deletedAt`

#### `Surgery`

- `id`
- `profileId`
- `code`
- `displayName`
- `performedDateRange`
- `anatomyEffectsJson`
- `note`
- `createdAt`
- `updatedAt`
- `deletedAt`

A surgery mutation must update anatomy state transactionally when anatomy effects are supplied.

#### `Medication`

- `id`
- `profileId`
- `name`
- `dose`
- `frequency`
- `prescriber`
- `reason`
- `startedDateRange`
- `endedDateRange`
- `status`: `active | paused | ended`
- `monitoringInstructions`
- `nextReviewDate`
- `createdAt`
- `updatedAt`
- `deletedAt`

Do not use medication-name string matching to generate monitoring tasks unless a reviewed medication rule references a normalized medication class.

### 9.5 Preventive-care catalog

#### `ServiceCatalog`

- `id`
- `slug`
- `name`
- `shortName`
- `category`
- `description`
- `bodySystem`, nullable
- `eventType`
- `active`
- `sortOrder`
- `createdAt`
- `updatedAt`

Categories:

- `cancer_screening`
- `cardiometabolic`
- `infectious_disease`
- `immunization`
- `bone_joint`
- `vascular`
- `mental_behavioral`
- `sensory_function`
- `routine_maintenance`
- `medication_monitoring`
- `custom`

#### `ServiceMethod`

- `id`
- `serviceId`
- `slug`
- `name`
- `description`
- `active`
- `metadataJson`
- Unique service/method slug.

Examples:

- Colonoscopy.
- FIT.
- Stool DNA-FIT.
- Flexible sigmoidoscopy.
- Mammography.
- Primary HPV testing.
- Cytology.
- Co-testing.
- PSA.
- Low-dose CT.
- DXA.
- Ultrasound.

### 9.6 Source and rule tables

#### `GuidelineSource`

- `id`
- `slug`
- `organization`
- `title`
- `canonicalUrl`
- `sourceType`
- `jurisdiction`
- `publishedAt`, nullable
- `effectiveAt`, nullable
- `lastVerifiedAt`
- `contentHash`, nullable
- `attributionText`, nullable
- `licenseOrTermsUrl`, nullable
- `active`
- `createdAt`
- `updatedAt`

#### `GuidelineRule`

- `id`
- `stableKey`
- `version`
- `serviceId`
- `variantId`
- `conflictGroup`, nullable
- `sourceId`
- `jurisdiction`
- `evidenceGrade`, nullable
- `recommendationClass`
- `appliesWhenJson`
- `excludesWhenJson`, nullable
- `stopWhenJson`, nullable
- `scheduleJson`
- `completionEventTypesJson`
- `allowedMethodsJson`, nullable
- `outcomeModifiersJson`, nullable
- `consumerSummary`
- `whyItMatters`
- `questionsForClinicianJson`
- `limitationsJson`
- `effectiveFrom`
- `effectiveTo`, nullable
- `reviewStatus`: `draft | reviewed | active | retired`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

Constraints:

- Unique `stableKey + version`.
- Only reviewed/active rules participate in production evaluation.
- A rule version is immutable after activation; create a new version to change logic.
- A retired rule remains available for historical explanation.

#### `ProfileGuidelineSelection`

- `id`
- `profileId`
- `conflictGroup`
- `variantId`
- `selectedByUserId`
- `selectedAt`
- Unique profile/conflict group.

### 9.7 Care history and plan tables

#### `CareEvent`

- `id`
- `profileId`
- `serviceId`
- `methodId`, nullable
- `performedStart`, nullable
- `performedEnd`, nullable
- `datePrecision`
- `result`
- `providerName`, nullable
- `locationName`, nullable
- `notes`, nullable
- `source`
- `importBatchId`, nullable
- `duplicateFingerprint`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `deletedAt`

The duplicate fingerprint should use normalized profile, service, method, date range, and provider. It is a warning signal, not an unconditional unique constraint.

#### `ClinicianOverride`

- `id`
- `profileId`
- `serviceId`
- `methodId`, nullable
- `overrideType`: `exact_next_date | recurring_interval | no_longer_needed | clinician_managed`
- `nextDueStart`, nullable
- `nextDueEnd`, nullable
- `intervalJson`, nullable
- `replacesGeneralGuideline`
- `clinicianName`, nullable
- `practiceName`, nullable
- `instructionReceivedDate`
- `reason`, nullable
- `reviewDate`, nullable
- `active`
- `createdByUserId`
- `createdAt`
- `updatedAt`

#### `RecommendationInstance`

- `id`
- `profileId`
- `serviceId`
- `ruleId`
- `ruleVersion`
- `variantId`
- `conflictGroup`, nullable
- `status`
- `recommendationClass`
- `dueStart`, nullable
- `dueEnd`, nullable
- `lastQualifyingEventId`, nullable
- `activeOverrideId`, nullable
- `explanationJson`
- `matchingFactsJson`
- `calculationHash`
- `evaluatedAsOf`
- `createdAt`
- `updatedAt`

Unique active snapshot per profile/rule version.

#### `PlannedAction`

- `id`
- `profileId`
- `recommendationInstanceId`, nullable
- `serviceId`
- `title`
- `plannedMonth`, nullable
- `appointmentStart`, nullable
- `appointmentEnd`, nullable
- `timezone`
- `location`, nullable
- `notes`, nullable
- `status`: `planned | scheduled | completed | cancelled`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Planning never changes the medical due date.

#### `Reminder`

- `id`
- `profileId`
- `plannedActionId`, nullable
- `recommendationInstanceId`, nullable
- `channel`: `in_app | email`
- `remindAt`
- `status`: `pending | sent | dismissed | cancelled`
- `dedupeKey`
- `sentAt`, nullable
- `createdAt`
- `updatedAt`

### 9.8 Files and operations

#### `Document`

- `id`
- `householdId`
- `profileId`
- `storageKey`
- `originalFilename`
- `safeFilename`
- `mimeType`
- `sizeBytes`
- `sha256`
- `uploadedByUserId`
- `createdAt`
- `deletedAt`

#### `DocumentLink`

- `id`
- `documentId`
- `careEventId`, nullable
- `medicationId`, nullable
- `clinicianOverrideId`, nullable
- `label`
- `createdAt`

#### `AuditLog`

- `id`
- `householdId`, nullable
- `profileId`, nullable
- `actorUserId`, nullable
- `action`
- `entityType`
- `entityId`
- `metadataJson`
- `ipHash`, nullable
- `userAgentFamily`, nullable
- `createdAt`

Do not store sensitive field values in audit metadata. Store what action occurred, not the health content itself.

#### `SourceSyncLog`

- `id`
- `sourceId`
- `startedAt`
- `finishedAt`, nullable
- `status`
- `httpStatus`, nullable
- `contentHash`, nullable
- `changed`
- `message`, nullable

#### `ExternalContentCache`

- `id`
- `sourceId`
- `cacheKey`
- `payloadJson`
- `contentHash`
- `fetchedAt`
- `expiresAt`
- `lastSuccessfulAt`
- Unique source/cache key.

#### `ImportBatch`

- `id`
- `profileId`
- `uploadedByUserId`
- `filename`
- `status`
- `rowCount`
- `validCount`
- `errorCount`
- `createdAt`
- `committedAt`, nullable

# Part-by-part execution plan

Each part is independently assignable. The stated dependencies are mandatory; the ownership paths minimize merge conflicts.

---

## Part 00 — Architecture contracts and repository skeleton

**Primary owner:** Lead/Integrator  
**Dependencies:** None  
**Owned paths:** Root configuration, `src/contracts/**`, `src/domain/shared/**`, `src/config/**`, initial route skeleton, `docs/architecture.md`

### Objective

Create the stable foundation that allows every other agent to build in parallel without inventing incompatible types, routes, or status semantics.

### Required work

1. Initialize the Next.js TypeScript project with pnpm.
2. Enable strict TypeScript options.
3. Configure:
   - ESLint.
   - Prettier.
   - Vitest.
   - Testing Library.
   - Playwright.
   - Tailwind.
   - shadcn/ui.
   - Prisma.
4. Install only packages with an immediate implementation use.
5. Create the target folder structure.
6. Add `goal.md` and `plan.md` to the repository root.
7. Define all cross-cutting contracts from Section 8.
8. Define route constants and navigation metadata.
9. Define environment parsing with Zod.
10. Create typed error classes:
    - `ValidationError`
    - `AuthenticationError`
    - `AuthorizationError`
    - `NotFoundError`
    - `ConflictError`
    - `ExternalSourceError`
11. Define a standard server-action result:
    ```ts
    type ActionResult<T> =
      | { ok: true; data: T }
      | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
    ```
12. Define a standard paginated result.
13. Add a request correlation ID helper that never embeds profile data.
14. Add a fake clock interface for deterministic tests:
    ```ts
    interface Clock {
      today(timezone: string): string;
      now(): Date;
    }
    ```
15. Add a system clock and test clock.
16. Add feature capability flags for:
    - SMTP configured.
    - External source sync enabled.
    - Demo mode.
17. Write `docs/architecture.md` with:
    - Application boundaries.
    - Data flow.
    - Authorization flow.
    - Rule evaluation flow.
    - Source sync flow.
    - Storage flow.
18. Create skeletal pages with meaningful loading states, not “Coming soon” placeholders.
19. Add a root error boundary and not-found page.
20. Add baseline test and build scripts.

### Required scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --check .",
  "format:write": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:seed": "tsx prisma/seed/index.ts",
  "sources:verify": "tsx scripts/verify-sources.ts",
  "sources:sync": "tsx scripts/sync-myhealthfinder.ts",
  "recommendations:rebuild": "tsx scripts/rebuild-recommendations.ts",
  "reminders:dispatch": "tsx scripts/dispatch-reminders.ts",
  "verify": "pnpm lint && pnpm format && pnpm typecheck && pnpm test && pnpm build"
}
```

Adapt the exact lint command to the selected Next.js version.

### Contracts to freeze

- Date ranges.
- Recommendation statuses.
- Recommendation classes.
- Care-plan modes.
- Anatomy states.
- Care-event results.
- Explanation tokens.
- Expression-tree schema.
- Schedule schema.
- API input/output schemas.
- Authorization semantics.
- Environment variables.
- Route paths.

### Tests

- Environment validation accepts a minimal development configuration.
- Environment validation rejects missing database and auth secrets.
- Test clock returns deterministic values.
- Action-result helpers preserve typed field errors.
- Route constants are unique.
- Importing domain contracts has no server-only side effects.

### Exit criteria

- `pnpm install` succeeds.
- `pnpm typecheck` succeeds.
- `pnpm test` runs at least the foundation tests.
- `pnpm build` reaches the expected database dependency boundary or succeeds with the initial local configuration.
- Every downstream agent can import stable contracts.

### Handoff

Record exact package versions, any contract decisions that differ from this plan, and the first migration command expected from Part 02.

---

## Part 01 — Visual system, application shell, and interaction primitives

**Primary owner:** Foundation Agent  
**Dependencies:** Part 00  
**Owned paths:** `src/components/ui/**`, `src/components/shell/**`, `src/styles/**`, app shell layouts, public icons and manifest assets

### Objective

Build the reusable interface system before feature agents create screens, preventing visual inconsistency and duplicate primitives.

### Design principles

- Calm.
- Spacious.
- Premium.
- Accessible.
- Clear status without alarmism.
- Strong hierarchy.
- Excellent mobile behavior.
- Neutral language.
- No hospital stock photography.
- No shame-based gamification.

### Required primitives

Create and document:

- Button variants.
- Icon button with mandatory accessible label.
- Text input.
- Email input.
- Password input.
- Date input.
- Approximate-date input.
- Select.
- Combobox.
- Multi-select.
- Checkbox.
- Radio group.
- Switch.
- Textarea.
- Form field wrapper.
- Error summary.
- Alert.
- Status badge.
- Evidence-class badge.
- Source badge.
- Card.
- Stat card.
- Empty state.
- Skeleton.
- Progress ring labeled “Care-plan completion.”
- Drawer.
- Modal dialog.
- Confirmation dialog.
- Sheet.
- Tabs.
- Accordion.
- Tooltip.
- Popover.
- Command menu.
- Toast.
- Breadcrumbs.
- Pagination.
- Data table for bulk-entry use only.
- Responsive timeline primitive.
- Calendar-month primitive.
- Print-only section.
- Offline banner.
- Source citation block.
- “Guidelines differ” comparison panel.
- Privacy indicator.
- Profile avatar generated from initials, never health attributes.

### Status language and presentation

Map statuses to labels:

- `future` → Coming later.
- `up_to_date` → Up to date.
- `due_this_year` → Recommended this year.
- `due_soon` → Due soon.
- `due_now` → Due now.
- `overdue` → Past the recommended window.
- `unknown_history` → History needed.
- `needs_date_confirmation` → Date needs confirmation.
- `discuss_with_clinician` → Discuss with a clinician.
- `clinician_managed` → Follow personal clinician plan.
- `not_routinely_recommended` → Not routinely recommended.
- `not_applicable` → Not applicable.
- `completed_once` → Completed.

Do not use red for all “due” states. Reserve high-urgency visual treatment for actual errors or destructive actions. Preventive tasks are important but generally not emergencies.

### App shell

Desktop:

- Collapsible left navigation.
- Household and profile switcher in the header.
- Page title and contextual actions.
- Main content container.
- Optional right detail panel.
- User menu.
- Privacy indicator for the active profile.

Mobile:

- Compact top header.
- Profile switcher sheet.
- Bottom navigation for Overview, Care Plan, Timeline, Records, and More.
- Full-screen detail sheets.
- Sticky primary actions only where useful.

### Global navigation

- Overview.
- Care Plan.
- Timeline.
- Calendar.
- Records.
- Medications.
- Family.
- Sources.
- Settings.

Hide profile-specific entries until a profile exists.

### Accessibility

- WCAG-oriented contrast.
- Semantic landmarks.
- Skip link.
- Keyboard-operable menus and dialogs.
- Focus restoration.
- Visible focus.
- No information conveyed by color alone.
- Screen-reader labels for status icons.
- Reduced-motion support.
- Minimum 44-pixel touch targets.
- Form errors associated with inputs.
- Heading order tests.
- Print output with readable contrast.

### PWA assets

Create:

- App icon set.
- Manifest.
- Theme color metadata.
- Standalone display settings.
- Offline page.
- Static-only service worker registration.
- Install prompt handling that never blocks use.

### Visual test fixtures

Create a development-only component gallery route protected from production or disabled outside development.

Include examples of:

- Every status.
- Long service names.
- Missing source dates.
- Competing guideline variants.
- Mobile card wrapping.
- Dark mode.
- Error and offline banners.
- Approximate-date control.

### Tests

- Keyboard navigation through shell.
- Mobile navigation labels.
- Dialog focus trap.
- Reduced-motion behavior.
- Status labels match contract.
- Color is not the only status signal.
- Component gallery has no console errors.
- Service worker does not cache authenticated routes.

### Exit criteria

- All feature agents can compose screens without creating new one-off base controls.
- Light and dark modes work.
- Desktop and mobile shells are complete.
- Loading, empty, error, and offline primitives exist.
- `axe` smoke tests pass for the shell and gallery.

---

## Part 02 — Database schema, migrations, repositories, and synthetic seed framework

**Primary owner:** Data Agent  
**Dependencies:** Part 00  
**Owned paths:** `prisma/**`, `src/server/db/**`, `src/server/repositories/**`, database factories

### Objective

Implement the complete persistent domain model, transactional repository layer, indexes, and deterministic synthetic seed framework.

### Required work

1. Implement every table in Section 9.
2. Add Auth.js-required tables.
3. Add enum types where stable.
4. Use JSON columns only for validated expression, schedule, metadata, and typed risk payloads.
5. Add foreign-key behavior deliberately:
   - Restrict deletion where history must remain.
   - Cascade only through truly dependent join rows.
   - Prefer soft deletion for user-facing health records.
6. Add indexes for:
   - Active household memberships.
   - Profiles by household.
   - Profile access grants.
   - Care events by profile/service/date.
   - Recommendation instances by profile/status/due date.
   - Reminders by status/remind time.
   - Rules by service/active version.
   - Source cache keys.
   - Audit rows by household/profile/time.
7. Add check constraints through SQL migrations where Prisma cannot express them:
   - Date-range start cannot be after end.
   - Exact date rows must have equal start and end.
   - Override fields must match override type.
   - File sizes must be non-negative.
8. Add repository interfaces and Prisma implementations.
9. Keep repositories free of authorization decisions; services enforce authorization.
10. Add transaction helpers for:
    - Creating a profile with anatomy.
    - Recording a care event and rebuilding recommendations.
    - Updating risk factors and rebuilding recommendations.
    - Applying a clinician override and rebuilding recommendations.
    - Accepting a profile claim.
    - Committing a CSV import.
11. Add deterministic factories for all entities.
12. Implement seed layers:
    - Core sources.
    - Service catalog.
    - Rule catalog.
    - Demo users and households.
13. Make seeding idempotent by stable keys.
14. Add database reset instructions for development only.
15. Add migration deployment and rollback guidance.
16. Do not place passwords or real tokens in committed seed files.
17. Derive demo credentials from environment variables with safe local defaults documented for development only.

### Repository methods

At minimum:

- `userRepository`
- `householdRepository`
- `profileRepository`
- `profileAccessRepository`
- `healthContextRepository`
- `serviceCatalogRepository`
- `guidelineRepository`
- `careEventRepository`
- `recommendationRepository`
- `plannedActionRepository`
- `reminderRepository`
- `documentRepository`
- `auditRepository`
- `sourceCacheRepository`
- `importRepository`

Each repository should support only the queries needed by service use cases. Avoid generic “find anything by arbitrary filter” interfaces.

### Data normalization

- Normalize email addresses.
- Trim user-facing text.
- Enforce maximum lengths.
- Store dates as database dates when no time is needed.
- Store appointments as timezone-aware timestamps.
- Store rule-effective dates as dates.
- Store `evaluatedAsOf` as a date.
- Preserve profile timezone.
- Avoid floating-point BMI persistence; derive from recorded measurements or use precise decimal types.

### Seed framework

The seed must create:

- Source organizations and verified metadata.
- Service categories and methods.
- Active rule versions.
- One synthetic household.
- Four synthetic profiles covering the core scenarios.
- Exact and approximate care events.
- A clinician override.
- A private profile.
- Planned actions.
- In-app reminders.
- Source comparison examples.

### Tests

- Migration applies to an empty test database.
- Seed runs twice without duplicate stable records.
- Date-range constraints reject invalid rows.
- Profile deletion does not delete another profile’s records.
- Recommendation lookup uses indexes.
- Soft-deleted records are excluded by default.
- Transactions roll back fully on recommendation rebuild failure.
- Profile claim preserves history and changes ownership atomically.
- Repository factories never use real-looking personal data.

### Exit criteria

- Clean migration and seed work.
- Prisma client generation works.
- Repositories have integration tests.
- Downstream agents can persist every required entity.
- Database schema documentation is generated or maintained in `docs/architecture.md`.

---

## Part 03 — Authentication, households, invitations, profile ownership, and privacy

**Primary owner:** Identity Agent  
**Dependencies:** Parts 00 and 02  
**Owned paths:** `src/server/auth/**`, `src/server/authorization/**`, auth routes, household/member routes, profile access services, related UI components

### Objective

Deliver secure identity, household membership, adult profile ownership, explicit sharing, and profile-claim workflows.

### Authentication requirements

Implement:

- Registration.
- Sign-in.
- Sign-out.
- Database sessions.
- Password hashing with Argon2id.
- Session rotation after sign-in.
- Session invalidation on password change.
- Authentication rate limiting.
- Generic credential error messages.
- Email normalization.
- Secure, HTTP-only, same-site cookies.
- CSRF protection compatible with Auth.js and Server Actions.
- Optional email verification only when SMTP is configured.
- Development-safe verification flow when SMTP is absent.
- Password change.
- “Sign out all devices.”
- Account deletion with current-password confirmation.

Do not build password-reset email as a hard dependency. If SMTP is configured, support secure expiring reset tokens. Otherwise explain in README that self-hosted administrators must use the documented local recovery command.

### Household requirements

Implement:

- Create household.
- Rename household.
- Update timezone.
- Invite member.
- Revoke invite.
- Accept invite.
- Change member role with owner safeguards.
- Remove member.
- Transfer household ownership.
- Prevent removal of the final owner.
- Leave household when not the final owner.

### Profile privacy model

Implement helper functions:

- `canViewProfile`
- `canEditProfile`
- `canManageProfileSharing`
- `canExportProfile`
- `canDeleteProfile`
- `canAccessDocument`
- `canViewHouseholdActivity`

Rules:

- Profile owner has full access.
- Explicit grant controls selected sharing.
- Household visibility grants view to active household members.
- Edit and manage require explicit permission.
- Unclaimed profiles may be managed by their creator and household owner until claimed.
- Once claimed, the adult owner’s privacy setting takes effect immediately.
- A household admin cannot silently override an owner-only claimed profile.
- The application should not expose the profile’s existence through error differences.

### Profile claiming

Flow:

1. Authorized household organizer creates an unclaimed adult profile.
2. Organizer sends a claim invite to an email address.
3. Invite uses a random token; database stores only a hash.
4. Recipient registers or signs in.
5. Recipient previews only:
   - Household name.
   - Profile display name.
   - Inviter name.
   - High-level privacy explanation.
6. Recipient accepts.
7. Ownership transfers atomically.
8. Recipient selects visibility.
9. Existing creator receives only a non-sensitive confirmation.
10. Audit events record issue, revoke, accept, and ownership transfer.

### Route protection

- Protect all `/app` routes.
- Validate active membership.
- Validate active profile access.
- Redirect unauthorized access to a neutral not-found page.
- Revalidate relevant caches after membership and sharing mutations.
- Prevent mass assignment of household, owner, and permission fields.

### Audit actions

Log:

- Sign-in success.
- Repeated sign-in failure threshold.
- Password change.
- Session invalidation.
- Household creation.
- Invite creation, acceptance, and revocation.
- Member role change.
- Member removal.
- Profile share grant and revoke.
- Profile claim.
- Profile export.
- Profile deletion.
- Account deletion.

Do not log passwords, tokens, diagnoses, medications, event notes, or document names.

### Tests

Unit:

- Permission matrix for owner, admin, member, profile owner, grantee, and stranger.
- Claimed and unclaimed profile cases.
- Soft-deleted memberships.
- Expired invites.
- Session-version invalidation.

Integration:

- Register and create household.
- Invite and accept.
- Claim profile.
- Revoke selected sharing.
- Transfer household ownership.
- Prevent final-owner removal.

End to end:

- User A cannot open User B’s private profile by changing the URL.
- User A cannot download User B’s document.
- Household owner cannot view a claimed owner-only adult profile without a grant.
- Shared member can view but cannot edit when permission is view-only.

### Exit criteria

- All auth and household flows work on desktop and mobile.
- Authorization helpers are the only path to private profile reads.
- Access-control tests pass.
- No private data appears in unauthorized error responses.

---

## Part 04 — Source registry, MyHealthfinder integration, caching, and attribution

**Primary owner:** Sources Agent  
**Dependencies:** Parts 00 and 02  
**Owned paths:** `src/server/sources/**`, source sync scripts, source registry seed, external-content cache services, attribution components

### Objective

Build transparent, privacy-preserving source infrastructure that can fetch consumer content, track provenance, detect staleness, and fall back safely when a source is unavailable.

### Source classes

Support:

- Federal recommendation source.
- Federal immunization source.
- Consumer-content source.
- Specialty-guideline source.
- App-authored maintenance template source.
- Clinician override source.

### Source registry fields

For each source, store:

- Stable slug.
- Organization.
- Title.
- Canonical URL.
- Jurisdiction.
- Source type.
- Published date when available.
- Effective date when available.
- Last verified date.
- Content hash.
- Terms or license URL.
- Required attribution.
- Active status.
- Internal reviewer note in source seed metadata, not exposed to users.

### MyHealthfinder integration

Implement a server-side client.

Requirements:

- Use only anonymous profile inputs required by the API.
- Never send name, email, profile ID, household ID, exact birth date, medication text, notes, or document data.
- Convert date of birth to age before the request.
- Use a cache key composed only of the anonymous parameter tuple and API version.
- Apply request timeout.
- Retry only safe transient failures with bounded backoff.
- Respect rate limits.
- Store the last successful payload and hash.
- Use the last successful payload when the live call fails.
- Clearly label cached content with its fetch date.
- Keep app-authored summaries visually separate from source-supplied text.
- Preserve required source attribution.
- Sanitize external HTML using an allowlist.
- Never execute external scripts.
- Never let external content determine an active medical rule automatically.

### Source sync command

`scripts/sync-myhealthfinder.ts` should:

1. Load known anonymous cache profiles or content topics.
2. Fetch current content.
3. Validate payload structure.
4. Sanitize content.
5. Calculate content hash.
6. Compare with prior content.
7. Store new cache entry.
8. Write `SourceSyncLog`.
9. Flag changed source content for review.
10. Exit non-zero only on actual operational failure, not merely unchanged content.

### Source verification command

`scripts/verify-sources.ts` should:

- Load all active rules.
- Confirm each references an active source.
- Confirm each source URL is syntactically valid.
- Check `lastVerifiedAt`.
- Mark or report sources older than the configured review threshold.
- Confirm active rules are reviewed.
- Confirm source and rule effective dates are coherent.
- Confirm conflict groups have a configured baseline.
- Confirm imported source text has required attribution.
- Produce human-readable and JSON reports.
- Avoid failing CI because the public internet is unavailable; support an offline structural mode.
- Support an explicit live mode for maintainers.

### Source UI components

Build reusable:

- Source citation.
- Source metadata panel.
- Last verified label.
- Cached-content notice.
- Attribution block.
- Stale-source warning.
- Guideline comparison metadata row.

### Tests

- PII fields never enter the MyHealthfinder client request.
- Cache key is anonymous and deterministic.
- Live failure returns a valid cached fallback.
- Malformed external content is rejected.
- Sanitizer removes scripts and dangerous attributes.
- Attribution is always rendered for MyHealthfinder content.
- Source-change hash creates a review flag.
- Offline verification works without network access.

### Exit criteria

- Source registry is queryable by all recommendation details.
- MyHealthfinder content has a safe cache fallback.
- No external API is necessary for the core rules engine to run.
- Stale and changed source states are visible to maintainers.

---

## Part 05 — Rule DSL, validation, authoring helpers, and version governance

**Primary owner:** Rules Authoring Agent  
**Dependencies:** Parts 00 and 02  
**Owned paths:** `src/contracts/rules.ts` proposals through Lead, `src/domain/rules/expression.ts`, authoring validators, rule fixture helpers, `docs/medical-rule-maintenance.md`

### Objective

Create a safe, serializable rule language expressive enough for adult preventive care while remaining understandable, testable, and reviewable.

### Expression-tree schema

Support these nodes:

```ts
type Expression =
  | { op: "all"; children: Expression[] }
  | { op: "any"; children: Expression[] }
  | { op: "not"; child: Expression }
  | { op: "age_between"; min?: number; max?: number; includeMin?: boolean; includeMax?: boolean }
  | { op: "anatomy_is"; key: AnatomyKey; state: AnatomyState }
  | { op: "sex_assigned_at_birth_is"; value: string }
  | { op: "risk_equals"; type: string; path: string; value: JsonPrimitive }
  | { op: "risk_number_compare"; type: string; path: string; comparator: NumericComparator; value: number }
  | { op: "condition_present"; code: string; statuses?: ConditionStatus[] }
  | { op: "condition_absent"; code: string }
  | { op: "family_history_present"; conditionCode: string; relationships?: string[]; maxAgeAtDiagnosis?: number }
  | { op: "surgery_present"; code: string }
  | { op: "medication_class_present"; classCode: string }
  | { op: "prior_event_exists"; serviceId: string; methodIds?: string[]; resultIn?: CareEventResult[] }
  | { op: "prior_event_absent"; serviceId: string }
  | { op: "time_since_event_compare"; serviceId: string; comparator: NumericComparator; duration: Duration }
  | { op: "profile_field_equals"; field: AllowedProfileField; value: JsonPrimitive }
  | { op: "constant"; value: boolean };
```

Do not support arbitrary object paths outside an allowlist.

### Derived facts

The evaluator may compute normalized derived facts:

- Age on `asOfDate`.
- BMI from most recent height and weight measurement.
- Pack-years.
- Years since quitting.
- Whether the person currently smokes.
- First-degree family-history match.
- Current anatomy state.
- Active condition set.
- Active medication classes.
- Most recent qualifying event by service and method.
- Time since a date range.
- Whether a vaccine dose series is complete.
- Whether an override is active.

Derived fact code belongs in the pure domain layer and must have unit tests.

### Schedule schema

Support:

#### Age-based schedule

```ts
type AgeBasedSchedule = {
  kind: "age_based";
  startAge?: number;
  stopAge?: number;
  interval?: Duration;
  initialDue?: "on_eligibility" | "calendar_year";
};
```

#### Interval schedule

```ts
type IntervalSchedule = {
  kind: "interval";
  interval: Duration;
  anchor: "last_qualifying_event" | "eligibility_date";
};
```

#### One-time schedule

```ts
type OneTimeSchedule = {
  kind: "one_time";
  dueOnEligibility: boolean;
};
```

#### Seasonal schedule

```ts
type SeasonalSchedule = {
  kind: "seasonal";
  seasonStartMonth: number;
  seasonEndMonth: number;
  repeatsAnnually: boolean;
};
```

#### Method-dependent schedule

```ts
type MethodDependentSchedule = {
  kind: "method_dependent";
  defaultMethodPrompt: boolean;
  methods: Array<{
    methodId: string;
    interval: Duration;
    qualifyingResults: CareEventResult[];
  }>;
};
```

#### Series schedule

```ts
type SeriesSchedule = {
  kind: "dose_series";
  seriesKey: string;
  doses: Array<{
    ordinal: number;
    minimumIntervalFromPrior?: Duration;
    recommendedIntervalFromPrior?: Duration;
  }>;
  boosters?: {
    interval: Duration;
  };
};
```

#### Shared-decision schedule

```ts
type SharedDecisionSchedule = {
  kind: "shared_decision";
  startAge?: number;
  stopAge?: number;
  repeatConversationAfter?: Duration;
};
```

#### Custom schedule

```ts
type CustomSchedule = {
  kind: "custom";
  requiresUserOrClinicianCadence: true;
};
```

### Duration schema

Support:

- Days.
- Weeks.
- Months.
- Years.

Use calendar arithmetic, not fixed day approximations for months and years.

### Outcome modifiers

Support reviewed modifiers such as:

- Abnormal or inconclusive event → clinician-managed.
- Specific surgery → no longer routine or requires clinician management.
- Prior diagnosis → exclude average-risk rule.
- Completed one-time event → completed once.
- User-declined event → keep recommendation active but record decision state without shame.
- Clinician “no longer needed” override → clinician-managed or not applicable with explicit provenance.

### Rule validation

A rule cannot become active unless:

- Stable key exists.
- Version is positive.
- Source exists.
- Service exists.
- Variant ID exists.
- Conflict group baseline is coherent.
- Expression tree validates.
- Schedule validates.
- Completion event types are non-empty where required.
- Summary and explanation exist.
- Source dates are present or explicitly marked unavailable.
- Reviewer, review date, and review status exist.
- Effective dates are coherent.
- Unit scenarios exist.

### Version governance

- Never mutate an active version.
- Clone to a new version.
- Mark old version with `effectiveTo`.
- Activate new version with `effectiveFrom`.
- Rebuild affected recommendation snapshots.
- Keep historical snapshot links to the rule version used at evaluation.
- Show “guideline updated” in timeline when an active change alters a profile’s result.
- Maintain a changelog entry.

### Rule authoring helpers

Build TypeScript factories such as:

- `defineRule`
- `all`
- `any`
- `not`
- `ageBetween`
- `anatomyIs`
- `riskNumber`
- `conditionPresent`
- `priorEventExists`
- `intervalSchedule`
- `methodDependentSchedule`
- `oneTimeSchedule`
- `sharedDecisionSchedule`

These helpers produce validated serializable JSON.

### Medical rule maintenance guide

`docs/medical-rule-maintenance.md` must explain:

- Source review workflow.
- How to create a service.
- How to create a source.
- How to create a rule.
- How to add a variant.
- How to create a conflict group.
- How to write scenarios.
- How to activate a version.
- How to retire a version.
- How to rebuild snapshots.
- How to review changed MyHealthfinder content.
- How to handle unclear or conflicting guidance.
- How to document limitations.
- Why an LLM or scraper must not directly activate logic.

### Tests

- Every expression node validates.
- Invalid paths are rejected.
- Empty `all` and `any` nodes are handled deliberately.
- Schedule types validate.
- Calendar durations serialize.
- Active rule mutation is prevented by service policy.
- New version retains stable key and increments version.
- Conflict groups reject multiple default baselines.
- Rule fixtures round-trip through JSON.

### Exit criteria

- Rule authors can define all initial catalog rules without custom code branches.
- Active rules are immutable and reviewable.
- The engine can consume the DSL without database dependencies.

## Part 06 — Service catalog and initial reviewed guideline rule set

**Primary owner:** Rules Authoring Agent  
**Dependencies:** Parts 04 and 05; database seed support from Part 02  
**Owned paths:** `prisma/seed/sources.ts`, `prisma/seed/services.ts`, `prisma/seed/rules.ts`, rule scenario fixtures, `docs/source-register.md`

### Objective

Seed a useful, transparent adult preventive-care catalog with source-backed logic, source variants, limitations, and tests.

### Governing rule

Do not rely on memory for current medical details.

At implementation time:

1. Verify the current official source.
2. Record the canonical source metadata.
3. Encode only what the source supports.
4. Add a scenario test.
5. Label uncertainty, selectivity, insufficient evidence, and recommendation-against status accurately.
6. Keep specialty variants separate.
7. Add a last-verified date.
8. Add a source changelog note.

The initial catalog must work offline after seeding. External content may enrich explanations but is not required to evaluate eligibility.

### Source hierarchy

Default evidence-based variant preference:

1. USPSTF A and B recommendations.
2. CDC/ACIP adult immunization guidance.
3. HRSA-supported preventive services.
4. Federal consumer content through MyHealthfinder.
5. Clearly labeled specialty alternatives.
6. App-authored customizable maintenance templates.

Do not force a federal source into a question it does not address. Use a specialty source only when clearly labeled and reviewed.

### Required service categories and stable slugs

#### Cancer screening

- `colorectal-cancer-screening`
- `breast-cancer-screening`
- `cervical-cancer-screening`
- `prostate-cancer-discussion`
- `lung-cancer-screening`
- `skin-health-review`

#### Cardiometabolic and general prevention

- `blood-pressure-screening`
- `prediabetes-type2-diabetes-screening`
- `lipid-cardiovascular-risk-review`
- `weight-bmi-review`
- `tobacco-use-review`
- `alcohol-use-review`
- `physical-activity-review`
- `nutrition-review`

#### Bone, vascular, and infectious disease

- `osteoporosis-screening`
- `abdominal-aortic-aneurysm-screening`
- `hepatitis-c-screening`
- `hiv-screening`
- `hepatitis-b-screening`
- `sti-screening`

#### Mental, behavioral, and functional health

- `depression-screening`
- `anxiety-screening`
- `intimate-partner-safety`
- `fall-risk-review`
- `hearing-review`
- `vision-review`
- `cognitive-concern-review`
- `functional-status-review`

#### Immunizations

- `influenza-vaccine`
- `covid-vaccine`
- `tdap-td-vaccine`
- `zoster-vaccine`
- `pneumococcal-vaccine`
- `rsv-vaccine`
- `hpv-vaccine`
- `hepatitis-a-vaccine`
- `hepatitis-b-vaccine`
- `mmr-vaccine`
- `varicella-vaccine`

#### Routine maintenance

- `primary-care-check-in`
- `dental-care`
- `eye-exam`
- `hearing-care`
- `skin-care`
- `medication-reconciliation`
- `advance-care-planning`
- `fall-prevention-home-safety`
- `specialist-follow-up`
- `prescription-renewal`
- `custom-lab-bundle`

#### Lab library

- `lipid-panel`
- `hemoglobin-a1c`
- `fasting-glucose`
- `kidney-function-panel`
- `liver-function-panel`
- `complete-blood-count`
- `thyroid-testing`
- `vitamin-d-testing`
- `psa-test`
- `custom-lab`

### Required method catalog

Colorectal methods:

- Colonoscopy.
- FIT.
- Stool DNA-FIT or current source-equivalent method naming.
- Flexible sigmoidoscopy.
- CT colonography.
- Any other method explicitly supported by the active source.

Cervical methods:

- Primary high-risk HPV testing.
- Cervical cytology.
- Co-testing.
- Source-specific method combinations.

Vaccination methods:

- Product-agnostic dose records unless product matters to the schedule.
- Product field in event metadata only when needed.

Other methods:

- Mammography.
- PSA.
- Low-dose CT.
- DXA.
- Abdominal ultrasound.
- Blood test.
- Questionnaire.
- Clinical discussion.
- Dental visit.
- Eye exam.

### Cancer-rule requirements

#### Colorectal

Encode:

- Average-risk eligibility.
- Routine age range.
- Selective older-adult decision range.
- Exclusions for prior colorectal cancer, high-risk syndromes, or other history requiring clinician management.
- Method-dependent intervals.
- Normal-result qualification.
- Unknown method prompting history clarification.
- Abnormal result exit to clinician management.
- No cross-method interval substitution.
- Source-specific variants when appropriate.

Scenario tests:

- Newly eligible profile with no history.
- Normal colonoscopy five years ago.
- Normal FIT at its proper interval.
- Year-only colonoscopy date.
- Unknown method.
- Abnormal prior result.
- Older adult in selective range.
- Prior colorectal cancer.

#### Breast

Encode:

- Anatomy-aware eligibility.
- Baseline federal variant.
- Specialty alternative.
- Distinct intervals and age behavior by variant.
- Prior breast cancer or abnormal history exit.
- Unknown anatomy prompt.
- Guideline conflict group.

Scenario tests:

- Eligible profile with no history.
- Up-to-date exact mammogram.
- Approximate-year mammogram.
- Selected specialty variant changes next due range.
- Prior abnormal result.
- Absent breast tissue or bilateral mastectomy history handled appropriately.

#### Cervical

Encode:

- Cervix-aware eligibility.
- Federal variant.
- Specialty variant.
- Method-dependent schedule.
- Stop rules.
- Surgery and history implications.
- Abnormal history exit.
- Unknown cervix state prompts profile completion.
- Conflict group.

Scenario tests:

- Eligible profile with exact cytology.
- Primary HPV method.
- Co-test.
- No cervix with no special history.
- No cervix with prior high-risk history requiring clinician management.
- Unknown method.
- Approximate-year event.

#### Prostate

Encode:

- Prostate-aware eligibility.
- Shared-decision classification.
- Baseline age window.
- Recommendation-against or non-routine state outside the active source’s routine/shared-decision scope.
- Higher-risk context only when supported and clearly labeled.
- No automatic annual PSA cadence.
- Clinician override support.
- Prior prostate cancer exit.

Scenario tests:

- 57-year-old with prostate.
- 57-year-old without prostate.
- Older adult outside baseline shared-decision range.
- Active clinician PSA interval.
- Prior prostate cancer.

#### Lung

Encode:

- Age.
- Pack-years.
- Current smoking status.
- Quit timing.
- Annual schedule while eligible.
- Stop conditions.
- Prior lung cancer or abnormal finding exit.
- Incomplete tobacco history prompt.

Scenario tests:

- Current smoker above threshold.
- Former smoker within quit window.
- Former smoker outside quit window.
- Insufficient pack-years.
- Missing packs-per-day data.
- Age boundary.
- Abnormal prior low-dose CT.

#### Skin health

Encode as:

- Custom maintenance or discussion.
- No universal overdue state when evidence is insufficient.
- Risk-based or clinician-defined cadence only when a reviewed source supports it.
- User can create a recurring personal skin check without it appearing as a federal requirement.

### Cardiometabolic-rule requirements

#### Blood pressure

Encode current source-backed eligibility and interval guidance with appropriate uncertainty labels where the source does not establish one universal cadence.

Support:

- Age and risk context.
- Prior hypertension or abnormal measurements → condition/clinician-managed path.
- Home measurement event is not automatically equivalent to a clinical screening unless the rule says so.
- Custom clinician interval.

#### Diabetes and prediabetes

Encode:

- Current baseline age range.
- Overweight/obesity criterion where applicable.
- Reasonable repeat interval after a normal result when supported.
- Uncertainty statement for optimal interval.
- Prior diagnosis exits screening path.
- Pregnancy-related diabetes care is outside scope.

#### Lipids and cardiovascular-risk review

Encode:

- Evidence-based risk assessment rather than a universal annual lipid panel.
- Age and cardiovascular risk context.
- Previous cardiovascular disease exits primary-prevention screening path.
- Clinician-defined cadence.
- Link lipid lab events only when they qualify.

#### Weight and BMI

Encode as a periodic assessment or maintenance item, not a moral score.

Store:

- Height.
- Weight.
- Measurement date.
- Derived BMI.
- No automatic diagnosis based solely on BMI.

#### Tobacco and alcohol

Encode periodic assessment and discussion.

Do not provide treatment instructions. Link to source content and allow a user to record a conversation or questionnaire as completed.

### Bone, vascular, and infectious-rule requirements

#### Osteoporosis

Encode source-specific variants where risk-based age/sex/anatomy guidance differs.

Support:

- Risk-based evaluation.
- Prior osteoporosis or fragility fracture → clinician-managed.
- DXA as method.
- Unknown prior result.
- Personal override.

#### Abdominal aortic aneurysm

Encode:

- One-time nature.
- Ever-smoked criterion.
- Selective and not-recommended variants where the source distinguishes groups.
- Family-history context where supported.
- Completion prevents recurrence.
- Abnormal result exits routine path.

#### Hepatitis C

Encode:

- One-time routine age range.
- Repeat only for ongoing risk where source supports it.
- Prior positive result exits screening path.
- Completed negative event suppresses repeat absent ongoing risk.

#### HIV

Encode:

- Routine age range.
- Risk-based eligibility outside that range.
- Repeat behavior only with ongoing risk.
- Prior positive result exits screening path.

#### Hepatitis B and STI

Encode only reviewed risk-based criteria that can be represented respectfully and with consent.

Use privacy-conscious labels. Do not expose sensitive risk details in household activity or reminder subjects.

### Mental, behavioral, and functional-rule requirements

For depression, anxiety, alcohol, safety, falls, hearing, cognition, and function:

- Correctly label recommendation class.
- Do not diagnose from a result.
- Allow a completed questionnaire or clinician discussion event.
- Store only user-entered result category and notes.
- Move concerning or abnormal results to clinician-managed status.
- Avoid universal cadence where source does not define one.
- Allow custom personal cadence.
- Keep intimate-partner safety data private and excluded from household activity.

### Immunization-rule requirements

Represent current CDC adult guidance with:

- Age-based schedule.
- Condition-based schedule.
- Dose series.
- Dose count.
- Minimum intervals where needed.
- Recommended intervals.
- Prior vaccination history.
- Seasonal behavior.
- Product-specific distinctions only when necessary.
- Contraindication and precaution content as non-personalized source information.
- Active CDC addenda and effective dates.
- Clinician override.

Do not attempt individualized vaccine safety clearance.

Each vaccine needs scenarios for:

- Never vaccinated.
- Partial series.
- Completed series.
- Unknown dates.
- Age transition.
- Relevant condition.
- Minimum-interval violation.
- Approximate-year historical dose.
- Current seasonal period where applicable.

### Routine-maintenance templates

Seed templates as editable and disabled or “ask/customize” by default unless sourced.

Each template includes:

- Suggested discussion label.
- No claim of federal recommendation unless sourced.
- Optional recurring cadence.
- Option to disable.
- Option to replace with clinician plan.
- Plain-language purpose.
- No overdue red state until the user chooses a cadence.

### Rule fixtures and source register

For each active rule, add:

- Stable rule key.
- Source slug.
- Service slug.
- Variant ID.
- Conflict group if any.
- Recommendation class.
- Source verification date.
- Reviewer.
- Scenario fixture IDs.
- Known limitations.

Generate `docs/source-register.md` from seed metadata or maintain it in sync.

### Tests

- Every active rule has at least one positive and one negative scenario.
- Boundary ages are tested.
- Each conflict group has one baseline.
- Each method-dependent rule has a scenario per method.
- Each one-time rule stays completed.
- Each shared-decision rule is not rendered as automatic overdue.
- Every rule source resolves.
- Every source has a last-verified date.
- No routine rule is backed only by app-authored text.
- No universal annual lab bundle is active by default.

### Exit criteria

- Seed creates a useful care plan for all demo profiles.
- Rule catalog is internally consistent.
- Source register is complete.
- Every active rule passes scenario validation.
- The catalog can be reviewed without reading application code.

---

## Part 07 — Pure deterministic recommendation engine

**Primary owner:** Rules Engine Agent  
**Dependencies:** Parts 05 and 06 contracts and fixtures  
**Owned paths:** `src/domain/rules/**`, `src/domain/dates/**`, engine unit tests

### Objective

Implement the pure function that evaluates a normalized profile and returns explainable recommendation instances with correct uncertainty handling.

### Public function

```ts
evaluateCarePlan({
  profile,
  anatomy,
  riskFactors,
  conditions,
  familyHistory,
  surgeries,
  medications,
  careEvents,
  clinicianOverrides,
  selectedVariants,
  guidelineRules,
  asOfDate
}): EvaluatedRecommendation[]
```

The function must:

- Have no database calls.
- Have no network calls.
- Have no current-time reads outside the passed date.
- Produce stable output for stable input.
- Be serializable.
- Be testable with fixtures.

### Evaluation pipeline

Implement in this order:

1. Validate normalized input.
2. Derive profile facts.
3. Select active rule versions for `asOfDate`.
4. Apply profile variant selection.
5. Apply baseline conflict-group selection when no selection exists.
6. Evaluate `appliesWhen`.
7. Evaluate `excludesWhen`.
8. Evaluate `stopWhen`.
9. Identify relevant care events.
10. Qualify events by service, event type, method, result, and rule.
11. Identify the latest qualifying event.
12. Apply outcome modifiers.
13. Calculate eligibility date.
14. Calculate due range.
15. Propagate date uncertainty.
16. Evaluate clinician overrides.
17. Assign status.
18. Generate matching facts.
19. Generate explanation tokens.
20. Return sorted, stable output.

### Derived fact rules

#### Age

- Calculate age on `asOfDate`.
- Handle birthdays exactly.
- Handle February 29 according to calendar convention documented in tests.
- Use profile timezone only to determine the local `asOfDate`; all pure calculations use date-only values.

#### BMI

- Use the most recent valid height and weight measurements that are reasonably paired.
- Do not calculate when units are missing or invalid.
- Keep raw measurement context.
- Do not label a diagnosis.

#### Pack-years

- `packsPerDay × yearsSmoked`.
- Support multiple smoking periods when present.
- Use an explicit quit date or year range.
- Propagate uncertainty when only a quit year is known.
- Do not infer current smoking from a missing end date unless status explicitly says current.

#### Family history

- Normalize first-degree relationships.
- Keep relationship and age-at-diagnosis facts.
- Do not infer genetic syndromes.

### Event qualification

An event qualifies only when:

- It belongs to the profile.
- It is not deleted.
- Its service or event type matches the rule.
- Its method is allowed when the rule is method-specific.
- Its result is in the qualifying set.
- It is not superseded by a correction.
- It occurred before or on `asOfDate`.
- It does not conflict with a known abnormal-history modifier.

Never use a stool test to satisfy a colonoscopy interval or vice versa unless the active rule explicitly permits cross-method completion.

### Date arithmetic

Use calendar arithmetic.

Examples:

- Add one year to February 29 using the documented date-fns behavior and tests.
- Add one month preserving end-of-month semantics where possible.
- A year-only event plus a 10-year interval becomes a full due-year range.
- A month-only event plus an interval becomes a month range.
- An unknown-date completed event cannot establish a reliable next date.

### Status precedence

Apply this precedence:

1. `not_applicable`
2. `not_routinely_recommended`
3. `clinician_managed`
4. `completed_once`
5. `discuss_with_clinician`
6. `unknown_history`
7. `needs_date_confirmation`
8. `overdue`
9. `due_now`
10. `due_soon`
11. `due_this_year`
12. `up_to_date`
13. `future`

Notes:

- A clinician override may move above routine status.
- An abnormal-history modifier produces `clinician_managed`.
- Shared-decision and selective rules generally produce `discuss_with_clinician`, with due timing included as context.
- Insufficient-evidence rules must never produce overdue.
- Not-recommended rules must never create reminders.
- One-time completion produces `completed_once`.
- Unknown anatomy needed for eligibility should produce a profile-information prompt represented in matching facts; the corresponding service is not marked overdue.

### Due windows

Evidence-based mode:

- `due_soon`: due begins within 90 days.
- `due_this_year`: due begins later in the same local calendar year.
- `future`: due begins after the current year.
- `due_now`: `asOfDate` falls within an exact or bounded recommended due window.
- `overdue`: `asOfDate` is after the latest acceptable due bound.

Extra-attentive mode:

- Use a 180-day `due_soon` planning window.
- Do not alter the source interval.
- Do not convert discussion items into routine tasks.

### Uncertainty algorithm

For a prior event date range and fixed interval:

- `earliestNextDue = addInterval(performedStart)`
- `latestNextDue = addInterval(performedEnd)`

Then:

- Before `earliestNextDue`: up to date.
- Between earliest and latest: `needs_date_confirmation`.
- After `latestNextDue`: overdue.
- If start and end are equal: use exact-date status logic.
- If both are unknown: `unknown_history` or `needs_date_confirmation` depending on whether completion is known.

For an eligibility age with unknown birth day, this should not occur because date of birth is required. Do not support age-only profiles in version one.

### Clinician overrides

Override behavior:

- `exact_next_date`: use the personal due range.
- `recurring_interval`: anchor to last qualifying event or instruction date as recorded.
- `no_longer_needed`: show clinician-managed with explanation.
- `clinician_managed`: remove routine due calculation from primary action.
- If `replacesGeneralGuideline = false`, keep both a personal action and general context.
- Expired or inactive overrides do not apply.
- Review date may create a reminder but does not change service eligibility.

### Explanation output

Each recommendation must include:

- Service.
- Rule stable key and version.
- Variant.
- Source.
- Matching facts.
- Last qualifying event.
- Due range.
- Status.
- Recommendation class.
- Active override.
- Explanation tokens.
- Limitations.
- Calculation trace safe for user display.
- Internal debug trace available only in development and tests, never production logs.

### Stable sorting

Sort by:

1. Status priority.
2. Earliest due date.
3. Service category order.
4. Service sort order.
5. Service name.

### Tests

Write exhaustive table-driven tests for:

- Every expression node.
- Every schedule kind.
- Every status.
- Age boundaries.
- February 29.
- Month-end arithmetic.
- Timezones around midnight.
- Year-only history.
- Month-only history.
- Unknown date.
- Method-specific intervals.
- One-time completion.
- Shared decision.
- Selective recommendation.
- Insufficient evidence.
- Recommendation against.
- Abnormal result.
- Prior diagnosis.
- Clinician override.
- Source variant selection.
- Rule version effective dates.
- Duplicate care events.
- Future-dated care events.
- Partial vaccine series.
- Seasonal schedules.
- Multiple smoking periods.
- Quit-year uncertainty.

### Required named scenarios

Implement the twelve scenarios from `goal.md` as named fixtures so failures are easy to interpret.

### Exit criteria

- Pure engine has no framework dependencies.
- All rule scenarios pass.
- Output is deterministic.
- Date uncertainty is preserved.
- Every active recommendation can explain itself.
- Coverage is high for domain logic, with branch coverage focused on decision paths rather than an arbitrary vanity percentage.

---

## Part 08 — Recommendation snapshots, recalculation, and change history

**Primary owner:** Data Agent or Rules Engine Agent  
**Dependencies:** Parts 02 and 07  
**Owned paths:** recommendation services, rebuild scripts, snapshot repositories, related integration tests

### Objective

Connect the pure engine to persistent profile data, rebuild snapshots safely, and identify meaningful plan changes.

### Rebuild service

Implement:

```ts
rebuildProfileRecommendations({
  profileId,
  actorUserId,
  asOfDate,
  reason
}): Promise<RebuildResult>
```

Reasons:

- Profile created.
- Profile edited.
- Anatomy changed.
- Risk changed.
- Condition changed.
- Family history changed.
- Surgery changed.
- Medication class changed.
- Care event created.
- Care event edited.
- Care event deleted.
- Guideline variant selected.
- Clinician override changed.
- Rule version activated.
- Manual rebuild.
- Daily maintenance.

### Transaction behavior

Within one transaction where possible:

1. Load authorized normalized profile state.
2. Load active rules.
3. Evaluate plan.
4. Upsert current recommendation snapshots.
5. Retire stale snapshots.
6. Compare old and new meaningful states.
7. Write non-sensitive activity events.
8. Write audit metadata.
9. Return changed recommendation IDs.

Do not place external API calls inside the transaction.

### Calculation hash

Calculate a deterministic hash from:

- Profile medical-input version.
- Relevant care-event version.
- Override version.
- Rule stable key and version.
- Selected variant.
- `asOfDate`.

Skip unnecessary writes when the hash and output are unchanged.

### Change classification

Classify changes as:

- Newly applicable.
- No longer applicable.
- Status changed.
- Due range changed.
- Source variant changed.
- Rule version changed.
- Clinician override activated.
- Clinician override removed.
- History uncertainty resolved.

Only create household activity when privacy allows and the event is not sensitive.

### Daily rebuild

Provide:

`scripts/rebuild-recommendations.ts`

Options:

- All profiles.
- One household.
- One profile.
- Rules changed since date.
- Dry run.
- Fixed `asOfDate`.
- Batch size.

The command must be resumable or idempotent. Log counts, not health details.

### Rule activation workflow

When a new rule version activates:

1. Identify affected service and jurisdiction.
2. Rebuild potentially affected profiles.
3. Preserve old snapshot references for timeline history.
4. Create a “guideline updated” event if the visible plan changed.
5. Do not silently delete historical explanation.

### Read model

Build query functions for:

- Overview counts.
- Needs-attention list.
- This-year list.
- Coming-up list.
- Unknown-history list.
- Up-to-date list.
- Discussion list.
- Timeline entries.
- Family aggregate counts.
- Reminder candidates.
- Visit-prep summary.

Apply profile authorization before returning any data.

### Tests

- Relevant mutation triggers rebuild.
- Irrelevant display-name change does not alter calculation hash.
- Rebuild is idempotent.
- Transaction rollback preserves previous snapshots on failure.
- New rule version updates only affected services.
- Profile variant selection changes active snapshot.
- Private changes do not create visible household activity.
- Daily rebuild handles birthdays and due-window transitions.

### Exit criteria

- The UI can use snapshots for fast reads.
- Care events and rules remain the source of truth.
- Changes are explainable and historically traceable.
- Rebuild commands work safely at household and full-database scale.

---

## Part 09 — Progressive onboarding and profile editor

**Primary owner:** Profile Agent  
**Dependencies:** Parts 01, 02, 03, and 08  
**Owned paths:** onboarding routes, profile form components, profile service mutations, profile validation

### Objective

Create respectful, progressive onboarding that captures enough information to generate a useful plan without presenting a giant medical questionnaire.

### Onboarding state model

Persist onboarding progress so users can leave and return.

Steps:

1. Household setup if none exists.
2. Profile basics.
3. Relevant anatomy.
4. High-impact risk factors.
5. Major conditions and history.
6. Medications.
7. Initial plan.
8. Guided backfill invitation.

A user may skip optional fields. Required fields:

- Display name.
- Date of birth.
- Country.
- Timezone.
- Relationship label.
- Sex assigned at birth response, including prefer not to answer.

Anatomy may be unknown, but dependent recommendations should then request clarification rather than assume absence.

### Step 1 — Basics

Fields:

- Display name.
- Relationship.
- Date of birth.
- Country, default US.
- Timezone, default household timezone.
- Sex assigned at birth.
- Optional gender identity.
- Privacy visibility.

Validation:

- Adult age 18 or older for version one.
- Date cannot be in the future.
- Display name length and safe characters.
- Timezone must be IANA-valid.

### Step 2 — Relevant anatomy

Ask only:

- Cervix.
- Breast tissue.
- Prostate.
- Uterus.
- Ovaries.

Use the explanation:

> Some preventive-care recommendations depend on which organs or tissue a person currently has, especially after surgery or gender-affirming care.

For each:

- Present.
- Absent.
- Unsure.
- Prefer not to answer.

Do not infer anatomy from gender identity. May offer a prefill based on sex assigned at birth only after explicit confirmation, but the safer default is direct respectful entry.

### Step 3 — High-impact risks

Ask:

- Tobacco status.
- Smoking periods.
- Average packs per day.
- Start and quit dates or years.
- Height and weight, optional.
- Pregnancy status where relevant.
- Immunocompromised status.
- Alcohol use assessment preference.
- Fall history or concern where relevant.
- Sensitive risk questions only when a rule requires them.

Show pack-year calculation and uncertainty.

Allow “I’m not sure.”

### Step 4 — Conditions, family history, and surgeries

Use searchable, curated options for the conditions that affect active rules.

Do not attempt a full medical ontology.

Capture:

- Major chronic conditions.
- Prior cancer.
- Prior abnormal screening history.
- First-degree family history.
- Relevant surgeries.
- Age at family member’s diagnosis when known.

When a surgery affects anatomy, show the proposed anatomy update and ask for confirmation.

### Step 5 — Medications

Provide an optional compact medication list.

Fields:

- Name.
- Dose.
- Frequency.
- Prescriber.
- Reason.
- Start date.
- Monitoring instruction.
- Next review date.

Do not infer arbitrary monitoring.

### Step 6 — Initial plan

After saving the profile:

- Run recommendation rebuild.
- Show a concise summary:
  - Needs attention.
  - This year.
  - Unknown history.
  - Discussions.
- Explain that the plan will improve after backfilling history.
- Offer:
  - Start guided backfill.
  - View dashboard.
  - Add clinician plan.

### Profile editor

Use sections matching onboarding.

Changes that affect recommendations should display:

> Updating this information may change the care plan.

After save:

- Rebuild.
- Show a summary of plan changes.
- Avoid revealing sensitive details in toasts.
- Provide undo only for simple display changes, not medical history writes.

### UX requirements

- One primary question group per screen.
- Progress indicator.
- Save and continue.
- Save and exit.
- Back button.
- Clear optional labels.
- Examples for approximate dates.
- Accessible explanations.
- Mobile keyboard behavior.
- No forced disclosure of gender identity.
- No shame-based copy around smoking, weight, alcohol, or missed care.

### Tests

- Adult age boundary.
- Invalid future birth date.
- Unknown anatomy.
- Tobacco pack-year calculation.
- Year-only quit date.
- Surgery updates anatomy.
- Skipped medications.
- Resume onboarding.
- Privacy selection.
- Initial plan rebuild.
- Profile edit changes relevant recommendation.
- Unauthorized user cannot edit profile.

### Exit criteria

- A new user can reach a meaningful plan in minutes.
- The profile model contains enough data for core rules.
- Optional and sensitive fields are handled respectfully.
- Onboarding works fully on mobile.

---

## Part 10 — Care events, guided backfill, bulk entry, and CSV import

**Primary owner:** Records Agent  
**Dependencies:** Parts 01, 02, 03, 06, and 08  
**Owned paths:** records routes, backfill components, event services, import services and route handlers

### Objective

Make historical data entry fast, uncertainty-aware, reversible, and central to plan accuracy.

### Care event CRUD

Implement:

- Create event.
- View event.
- Edit event.
- Soft delete event.
- Restore recent deletion where safe.
- Attach document.
- Link to recommendation.
- Rebuild plan after mutation.

Form fields:

- Service.
- Method.
- Performed timing.
- Date precision.
- Result category.
- Provider.
- Location.
- Notes.
- Source.
- Attachment.

Dynamic behavior:

- Method list depends on service.
- Result options explain that the app will not interpret findings.
- Abnormal or inconclusive result shows:
  > Routine timing may no longer apply. Record the follow-up plan from your clinician.
- Exact date, month/year, year-only, and unknown date use distinct controls.
- Future dates are rejected for completed events.

### Guided backfill queue

Generate questions from active recommendations and missing history.

Priority:

1. Services currently due or uncertain.
2. One-time screenings.
3. High-impact method-dependent screenings.
4. Vaccination series.
5. Recent maintenance.
6. Lower-priority custom items.

Each question should include:

- Why it is being asked.
- Service name.
- Common method examples.
- Answers:
  - Exact date.
  - Month and year.
  - Year only.
  - Completed, date unknown.
  - Never completed.
  - Not sure.
  - Skip.
- Follow-up method question when needed.
- Follow-up result category.
- Optional provider and note.

Do not ask irrelevant questions.

Persist queue progress and permit skipping.

### Backfill answer semantics

- “Never completed” creates a profile response state or event-history assertion, not a fake dated event.
- “Not sure” records uncertainty and keeps `unknown_history`.
- “Completed, date unknown” records a care event with unknown date precision.
- “Skip” does not change medical state.
- “Not applicable” requires a reason and may be a user preference rather than engine truth; do not override a rule unless supported by anatomy/history or clinician instruction.

### Bulk entry

Build a spreadsheet-like table optimized for keyboard use.

Columns:

- Service.
- Method.
- Date.
- Precision.
- Result.
- Provider.
- Source.
- Notes.
- Attachment indicator.

Features:

- Add row.
- Duplicate row.
- Paste tabular data.
- Inline validation.
- Keyboard navigation.
- Row-level errors.
- Save valid rows.
- Preserve unsaved local edits during validation.
- Mobile fallback to card forms.

### CSV template

Provide headers:

```csv
service,method,date,date_precision,result,provider,location,source,notes
```

Document accepted values.

Allow service and method lookup by stable slug or exact display name.

### CSV preview

Two-phase flow:

1. Upload CSV.
2. Parse server-side.
3. Normalize.
4. Validate every row.
5. Resolve services and methods.
6. Detect possible duplicates.
7. Return preview with:
   - Valid rows.
   - Warnings.
   - Errors.
   - Duplicate candidates.
8. User chooses which warning rows to include.
9. Commit transactionally.
10. Rebuild recommendations once after the batch.

Do not partially commit without explicit user choice.

### Import safety

- Limit file size.
- Limit row count.
- Reject formulas and unsupported encodings where relevant.
- Escape rendered cell values.
- Do not execute spreadsheet content.
- Store import batch metadata.
- Use idempotency token for commit.
- Do not retain raw CSV longer than necessary.
- Do not expose another profile’s services through lookup errors.

### Duplicate detection

Use:

- Same profile.
- Same service.
- Same method.
- Overlapping date range.
- Same normalized provider when present.

Present duplicate warning, not automatic deletion.

### Records page

Views:

- All history.
- By category.
- By year.
- Missing dates.
- Abnormal or clinician-managed.
- Imported.
- With documents.

Search fields:

- Service.
- Method.
- Provider.
- Year.

Do not index free-text notes in a global household search without privacy filtering.

### Tests

- Exact event changes due date.
- Year-only event creates range.
- Unknown-date completion remains uncertain.
- Wrong method does not satisfy rule.
- Abnormal result creates clinician-managed state.
- Edit triggers rebuild.
- Delete restores prior plan state.
- Guided queue hides irrelevant services.
- CSV preview catches unknown service.
- CSV commit is idempotent.
- Duplicate warning works.
- Unauthorized import and event access are denied.
- CSV injection strings render safely.
- Large file and row-limit errors are clear.

### Exit criteria

- A user can accurately backfill years of care.
- Approximate dates remain approximate.
- Import errors are recoverable.
- Recommendation updates occur once per successful batch.

## Part 11 — Overview dashboard, care plan, and recommendation detail

**Primary owner:** Care Plan Agent  
**Dependencies:** Parts 01, 03, 08, 09, and 10  
**Owned paths:** overview and care-plan routes, recommendation UI components, care-plan query adapters

### Objective

Build the primary experience that clearly answers what deserves attention next while preserving nuance, uncertainty, and source transparency.

### Profile overview

Header:

- Profile display name.
- Current age.
- Profile privacy indicator.
- Active care-plan mode.
- Profile switcher.
- Edit-profile action.
- Prepare-for-visit action.

Summary metrics:

- Needs attention count.
- Recommended this year count.
- Unknown history count.
- Discuss with clinician count.
- Care-plan completion ring.
- Next major age milestone.

The completion ring must be labeled clearly and calculated only from actionable routine items whose status can reasonably be completed. Exclude not-applicable, not-routinely-recommended, insufficient-evidence, and purely informational items. Explain the denominator in a tooltip.

### Primary next-action block

Show up to three highest-priority items.

Each includes:

- Service.
- Status.
- Due timing.
- One-sentence reason.
- Last event summary.
- Source organization.
- Primary action.
- Secondary detail action.

The block must not imply emergency urgency.

### Dashboard sections

#### Needs attention

Include:

- Overdue.
- Due now.
- Date needs confirmation.
- High-priority unknown history.

#### Recommended this year

Include:

- Due soon.
- Due this year.
- Seasonal items.

#### Coming up

Include:

- Future recommendations.
- Age milestones.
- Planned items beyond the current year.

#### Unknown history

Include:

- No record.
- Unsure.
- Completed but date unknown.
- Unknown method.
- Unknown anatomy or risk data needed for evaluation.

#### Up to date

Include routine items currently within interval.

#### Discuss with a clinician

Include:

- Shared decision.
- Selective recommendation.
- Insufficient evidence.
- Conflicting guidelines.
- Clinician-managed history.

### Recommendation card

Display:

- Service name.
- Category.
- Status label.
- Timing range.
- Last qualifying event.
- Short eligibility reason.
- Source.
- Plan indicator when scheduled.
- Clinician override indicator.

Actions:

- Add past record.
- Mark completed.
- Plan it.
- Add clinician instruction.
- Snooze.
- Not applicable or decline with explanation.
- Open details.

Action behavior:

- “Mark completed” opens an event form; it must not create a record without date/result confirmation.
- “Snooze” affects reminder display only, not medical status.
- “Not applicable” must distinguish user preference, anatomy/history, and clinician instruction.
- “Plan it” creates a planned action without changing due calculation.

### Care-plan page

Filters:

- Status.
- Category.
- Year.
- Recommendation class.
- Source organization.
- Planned/unplanned.
- With/without known history.

Views:

- Grouped cards.
- Compact list.
- Source comparison.
- Print-friendly summary.

Search by service name.

Persist non-sensitive view preferences per user.

### Recommendation detail

Sections:

1. **What this is**
   - Consumer summary.
   - Why it matters.
2. **Why it appears for this profile**
   - Matching facts.
   - Eligibility logic in plain language.
3. **Timing**
   - Start and stop behavior.
   - Interval.
   - Due range.
   - Exact calculation.
   - Uncertainty.
4. **Accepted methods**
   - Method names.
   - Method-specific intervals.
5. **History**
   - Last qualifying event.
   - Other related events.
   - Result category.
6. **Personal plan**
   - Planned action.
   - Reminder.
   - Clinician override.
7. **Guideline variants**
   - Baseline.
   - Alternatives.
   - Selection control.
8. **Benefits and limitations**
   - Source-backed summary.
9. **Questions for a clinician**
10. **Source and provenance**
    - Organization.
    - Title.
    - Link.
    - Publication/effective date.
    - Last verified date.
    - Evidence class.
    - Rule version.
    - Attribution.
11. **Change history**
    - Source/rule updates relevant to this recommendation.

### Guidelines-differ comparison

Use a side-by-side comparison on desktop and stacked comparison on mobile.

Rows:

- Organization.
- Eligible population.
- Start age.
- Stop age.
- Interval.
- Methods.
- Recommendation class.
- Evidence grade.
- Source date.
- Last verified date.
- Key difference.

Selection behavior:

- Explain that choosing a variant changes the organizer’s schedule, not clinical truth.
- Require explicit confirmation.
- Rebuild plan.
- Show what changed.
- Allow reset to federal baseline.

### Care-plan modes

Evidence-based:

- Baseline federal variants.
- 90-day due-soon window.
- Specialty alternatives visible in details.

Extra-attentive:

- 180-day planning window.
- More prominent specialty alternatives.
- Custom maintenance templates.
- Earlier source-supported conversations.
- No unsupported mandatory testing.

Clinician plan:

- Active overrides appear first.
- General guidance remains visible below.
- Missing personal instructions do not hide baseline guidance.

### Empty and transitional states

Examples:

- No profile.
- Profile onboarding incomplete.
- Plan generating.
- No due items.
- No history.
- External source content unavailable.
- Stale source.
- Rule update in progress.
- Private profile access changed.

### Tests

- Overview counts match snapshots.
- Completion denominator excludes informational items.
- Cards render all statuses.
- Shared decision never uses overdue language.
- Variant switch rebuilds and updates due range.
- Snooze does not alter status.
- Plan action does not alter due date.
- Detail shows exact matching facts and rule version.
- Cached source fallback displays correctly.
- Mobile cards remain usable with long source names.
- Unauthorized recommendation detail is hidden.

### Exit criteria

- A user can understand the next action from the overview.
- Every recommendation is explainable.
- Conflicts and uncertainty are visible.
- No status language overstates medical certainty.

---

## Part 12 — Annual roadmap, longitudinal timeline, planning calendar, and milestones

**Primary owner:** Planning Agent  
**Dependencies:** Parts 01, 08, 10, and 11  
**Owned paths:** timeline and calendar routes, planning components, planned-action services

### Objective

Turn the care plan into a comprehensible history and future roadmap without conflating planning dates with medical due dates.

### Annual roadmap

Display January through December plus:

- Anytime this year.
- Date needs confirmation.
- Unscheduled future.

Placement:

- Exact due or appointment date → month.
- Bounded due range within one month → month.
- Due range spanning months → earliest month with range label.
- Flexible annual item → Anytime this year.
- Unknown timing → Date needs confirmation.
- Planned month → show plan chip without modifying due range.

Interactions:

- Drag or select a flexible item into a planned month.
- Open plan dialog.
- Add appointment.
- Add reminder.
- Mark completed through event form.
- Revert plan.

Do not allow dragging to silently rewrite medical due dates.

### Longitudinal timeline

Entry types:

- Care event.
- Recommendation became applicable.
- Due status change.
- Planned action.
- Appointment.
- Clinician override.
- Guideline variant selection.
- Rule version update.
- Profile milestone.
- Document added.
- History uncertainty resolved.

Time filters:

- Entire history.
- Past five years.
- Current year.
- Next five years.
- Category.
- Entry type.

Privacy:

- Sensitive details remain within profile authorization.
- Household activity is a separate, redacted feed.
- Timeline entries may show source changes but not internal implementation metadata.

### Future milestones

Generate:

- Next birthday-related eligibility change.
- Start age for upcoming rules.
- Stop age for current rules.
- Vaccine age transitions.
- One-time screening windows.
- Planned clinician-review dates.
- Upcoming custom maintenance.

Questions the view should answer:

- What changes next year?
- What begins at age 60 or 65?
- What stops being routinely recommended?
- Which decisions need a clinician discussion?

### Calendar view

Views:

- Month.
- Agenda.
- Year.

Show:

- Planned month.
- Exact appointment.
- Reminder.
- Due range.
- Seasonal item.

Use different shapes or labels, not only color, to distinguish medical timing from user planning.

### Planned action form

Fields:

- Service or custom title.
- Planned month.
- Appointment start/end.
- Timezone.
- Location.
- Notes.
- Reminder timing.
- Status.

Validation:

- Appointment end after start.
- No medical interpretation.
- Profile authorization.
- Timezone-aware.
- Past appointment allowed only for backfill, which should instead suggest recording a care event.

### Snooze behavior

Snooze:

- Hides an item from the top reminder surfaces until a date.
- Does not change engine status.
- Does not change due date.
- Remains visible in the recommendation detail.
- Must have a maximum configurable duration for overdue items, after which it resurfaces.
- Can be cancelled.

### Calendar export

Generate RFC-compliant `.ics` files for:

- One planned action.
- One appointment.
- Selected annual roadmap items.

Include:

- Neutral title.
- Date/time.
- Timezone.
- Location.
- Non-sensitive description.
- Link back to the app only when base URL is configured.
- Stable UID.
- Update sequence when regenerated.

Do not include diagnoses, risk factors, or result details.

### Tests

- Exact event appears in correct timeline date.
- Year-only event appears as approximate.
- Flexible annual item appears in Anytime.
- Planning month does not alter due date.
- Dragging is keyboard accessible.
- Age milestone uses profile timezone and birth date.
- Stop-age milestone appears.
- `.ics` parses in a test parser.
- Appointment timezone is correct.
- Snooze hides reminder but not recommendation.
- Private profile timeline cannot be fetched by another user.

### Exit criteria

- Users can see past, present, and future in one coherent model.
- Planning is clearly separate from medical timing.
- Calendar export works across timezones.
- Timeline is useful on mobile.

---

## Part 13 — Family dashboard, sharing controls, profile claiming, and household activity

**Primary owner:** Family Agent  
**Dependencies:** Parts 01, 03, 08, and 11  
**Owned paths:** family routes, family components, activity-feed queries, sharing UI

### Objective

Support family coordination without making household membership a blanket license to view another adult’s health information.

### Family dashboard

For each profile the current user may view, show:

- Display name.
- Relationship.
- Age.
- Privacy state.
- Due-now count.
- Due-this-year count.
- Unknown-history count.
- Next action.
- Last profile update.
- Claim status.

For profiles the user knows exist but cannot view, normally show nothing. If a household organizer needs administrative awareness, show only a generic “Private adult profile” membership tile when this is necessary for invite or household management, never health counts.

### Household overview

Show:

- Number of visible profiles.
- Pending household invites.
- Pending profile claims.
- Household timezone.
- Non-sensitive recent activity.
- Add profile.
- Invite member.

### Activity feed

Allowed examples:

- “A care record was added to Dad’s shared profile.”
- “Mom’s shared care plan changed.”
- “Alex scheduled an appointment.”
- “A household invitation was accepted.”

Preferred activity should be minimally revealing. When profile sharing allows it, service names may be shown only if the profile owner has opted into detailed household activity.

Never include in household activity:

- Intimate-partner safety.
- Sexual-health risks.
- Mental-health result details.
- Medication names.
- Diagnoses.
- Abnormal result details.
- Free-text notes.
- Document filenames.
- Tobacco or alcohol values.
- Exact appointment purpose unless explicitly shared.

### Sharing controls

Profile owner can choose:

- Owner only.
- Selected members.
- Whole household.

For selected members:

- View.
- Edit.
- Manage.

Explain permissions in plain language.

Changes take effect immediately and invalidate relevant server caches.

### Profile claiming UI

Organizer:

- Select unclaimed profile.
- Enter invite email.
- Review what will transfer.
- Send claim invite.
- Revoke invite.

Recipient:

- Open claim.
- Sign in or register.
- See minimal profile identity.
- Accept ownership.
- Choose privacy.
- Review current grants.
- Continue to profile.

After claim:

- Previous organizer retains access only if recipient explicitly grants it or selects household visibility.
- Claim acceptance audit is visible to both parties without health details.

### Family quick actions

- Add past record for a profile the user may edit.
- Open care plan.
- Start backfill.
- Prepare visit.
- Manage sharing.
- Invite profile owner.

### Tests

- Family counts include only visible profiles.
- Private profile details are absent from server-rendered payload.
- Sharing grant changes access immediately.
- Claim removes implicit creator access.
- Detailed activity opt-in works.
- Sensitive services never enter household activity.
- Invite expiration and revocation work.
- Mobile family cards remain clear.

### Exit criteria

- Family coordination is useful.
- Privacy behavior is understandable.
- No adult profile is exposed merely because it belongs to a household.

---

## Part 14 — Medications, clinician overrides, custom maintenance, and personal care plans

**Primary owner:** Clinical Context Agent  
**Dependencies:** Parts 01, 03, 08, 09, and 11  
**Owned paths:** medication routes, override routes, custom maintenance services and UI

### Objective

Capture clinician-specific context and user-defined routines without inventing medical monitoring logic.

### Medication list

Views:

- Active.
- Paused.
- Ended.
- Review due.
- Monitoring instruction present.

Medication fields:

- Name.
- Dose.
- Frequency.
- Prescriber.
- Reason.
- Start timing.
- End timing.
- Status.
- Monitoring instructions.
- Next medication review.
- Notes kept concise.

Use autocomplete only from a local optional common-name list. Do not require an external medication database.

### Medication privacy

- Medication names never appear in household activity by default.
- Medication reminders use neutral subjects such as “Medication review reminder.”
- Exports include medications only for the authorized profile.
- Audit logs record medication record changes without values.

### Monitoring behavior

A medication may create a task only through:

- Explicit clinician monitoring instruction.
- Explicit user-created reminder.
- A reviewed rule tied to a normalized medication class.

Do not infer:

- Lab type.
- Frequency.
- Safety instructions.
- Dose changes.
- Drug interactions.

### Clinician override creation

Entry points:

- Recommendation card.
- Recommendation detail.
- Medication.
- Custom care plan.
- Records follow-up.

Required fields:

- Service.
- Override type.
- Instruction date.
- Replace or supplement.
- Personal interval or next date when relevant.
- Clinician or practice, optional.
- Reason or note, optional.
- Review date, optional.

UX:

- Preview how the care plan will change.
- Confirm.
- Rebuild.
- Show baseline guidance below the personal plan.
- Allow pause, edit, and end.
- Preserve history.

### Override edge cases

- Exact next date in past → status based on personal plan and neutral overdue language.
- Interval without anchor → require instruction date or last qualifying event.
- Multiple active replacing overrides for same service → prevent or require resolving conflict.
- Supplemental override → create a separate personal action while retaining baseline.
- “No longer needed” → show clinician-managed, not engine-derived not-applicable.
- Expired review date → prompt review, do not silently reactivate baseline if override remains active.

### Custom maintenance

Users can create:

- Custom service title.
- Category.
- Purpose.
- Recurrence.
- Start date.
- Stop date.
- Reminder.
- Clinician attribution.
- Visibility.
- Notes.

Label custom items:

- Personal reminder.
- Clinician instruction.
- Health-maintenance cadence.

Never label them as federal recommendations.

### Custom lab bundle

Allow:

- Bundle name.
- Individual lab entries.
- Personal or clinician source.
- Cadence.
- Next date.
- Notes.

Display:

> This is a personal or clinician-defined lab plan, not a universal annual screening requirement.

### Maintenance template adoption

For seeded templates:

- Ask user to choose a cadence.
- Offer “Ask my clinician.”
- Allow disable.
- Record source as app template or clinician.
- Do not create overdue status until cadence is chosen.

### Tests

- Medication CRUD and privacy.
- No task inferred from arbitrary medication name.
- Clinician exact-date override takes precedence.
- Supplemental override coexists with baseline.
- Ended override restores baseline.
- Custom item is labeled correctly.
- Custom lab warning always displays.
- Multiple replacing overrides are prevented.
- Unauthorized medication and override access is denied.

### Exit criteria

- Users can represent personal clinician instructions accurately.
- Baseline guidance remains transparent.
- The app never invents medication-monitoring care.

---

## Part 15 — Private documents, visit preparation, print, data export, and calendar files

**Primary owner:** Documents Agent  
**Dependencies:** Parts 02, 03, 10, 11, and 14  
**Owned paths:** storage adapters, document route handlers, visit-prep routes, export services, print styles

### Objective

Provide secure file attachment, practical doctor-visit preparation, and user-controlled exports without leaking private data.

### Storage adapter

Define:

```ts
interface PrivateStorage {
  put(input: {
    stream: ReadableStream | NodeJS.ReadableStream;
    contentType: string;
    size: number;
  }): Promise<{ storageKey: string; sha256: string }>;

  get(storageKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    size: number;
  }>;

  delete(storageKey: string): Promise<void>;
}
```

Implement local filesystem storage.

Requirements:

- Random opaque storage keys.
- No original filename in filesystem path.
- Private Docker volume.
- Atomic write.
- Size limit.
- MIME allowlist.
- Content sniffing.
- SHA-256.
- Authenticated download route.
- `Content-Disposition` with sanitized filename.
- `X-Content-Type-Options: nosniff`.
- No public URL.
- Deletion on profile/account deletion according to retention policy.
- Cleanup for abandoned uploads.

Default allowed types:

- PDF.
- JPEG.
- PNG.

Default max size:

- 10 MB, configurable.

Document the absence of virus scanning as a version-one limitation. Do not attempt OCR.

### Document linking

Allow a document to link to:

- Care event.
- Medication.
- Clinician override.
- Profile record.

Show metadata:

- Safe filename.
- Type.
- Size.
- Upload date.
- Linked record.
- Uploaded by.

Do not render PDFs inline by default. Offer authenticated download/open.

### Doctor-visit agenda

One-page print target:

- Profile name.
- Age.
- Date generated.
- Current medications.
- Allergies if the profile supports them.
- Major conditions.
- Due-now items.
- Due-this-year items.
- Unknown history to clarify.
- Shared-decision items.
- Clinician-managed follow-up.
- Recent abnormal or inconclusive event labels without interpretation.
- User-selected questions.
- Personal notes.
- Source disclaimer.

Controls:

- Include/exclude sections.
- Add question.
- Reorder questions.
- Add appointment information.
- Print.
- Copy summary.
- Export calendar item.
- Save draft preferences.

Privacy:

- Only current profile data.
- No household feed.
- No hidden metadata.
- No document links unless explicitly selected.
- Never include another adult’s data.

### Print behavior

- Use dedicated print CSS.
- Hide navigation and controls.
- Avoid clipped cards.
- Use black-on-white readable output.
- Break sections intelligently.
- Include source URLs in printable text where appropriate.
- Keep within one page for default concise mode.
- Allow extended mode to span pages.

Browser PDF printing is the supported PDF path. Do not add a server PDF dependency unless needed for correctness.

### Clipboard summary

Generate plain text with:

- Neutral headings.
- No markdown tables.
- Source links where useful.
- “Generated by CareCadence” disclaimer.

Use the Clipboard API with fallback.

### Profile export

Export a ZIP containing:

- `profile.json`
- `care-events.csv`
- `medications.csv`
- `clinician-overrides.csv`
- `planned-actions.csv`
- `sources.csv`
- `documents/`
- `README.txt`

Include schema version and generation date.

### Household export

Household owner may export:

- Household structure.
- Only profiles they are authorized to export.
- A manifest listing omitted private profiles without identifying medical contents.

Do not let household ownership bypass profile export permissions.

### Deletion

Profile deletion flow:

- Show consequences.
- Require display-name confirmation.
- Offer export first.
- Soft delete database records.
- Queue or immediately delete document blobs.
- Remove reminders.
- Invalidate sessions/caches as relevant.
- Write audit event without content.
- Document recovery window if soft-delete recovery is supported.

Account deletion:

- Resolve household ownership first.
- Export option.
- Remove memberships.
- Delete owner-only profiles.
- Transfer or delete shared household data according to explicit choices.
- Invalidate all sessions.

### Tests

- Unauthorized document download returns neutral not found.
- MIME spoofing rejected.
- Oversized file rejected.
- Storage path traversal impossible.
- Document deletion removes blob.
- Visit agenda includes only selected profile.
- Print snapshot is readable.
- Clipboard output is plain text.
- Profile ZIP contains expected files.
- Household export excludes private unauthorized profile.
- Calendar file contains no diagnosis or result details.
- Account deletion invalidates sessions.

### Exit criteria

- Attachments are private and usable.
- Visit prep is practical and printable.
- Users can export and delete their data.
- No export bypasses profile privacy.

---

## Part 16 — Reminder center, planning prompts, and optional email dispatch

**Primary owner:** Planning Agent or Documents Agent  
**Dependencies:** Parts 02, 03, 08, 12, and 14  
**Owned paths:** reminder routes, notification components, email adapter, dispatch script

### Objective

Provide neutral, configurable reminders without requiring external infrastructure or turning preventive recommendations into alarmist alerts.

### In-app reminder center

Sections:

- Today.
- Upcoming.
- Snoozed.
- Dismissed.
- Sent email history when configured.

Reminder types:

- Recommendation due soon.
- Recommendation due this year.
- Planned appointment.
- Clinician-plan review.
- Medication review.
- Custom maintenance.
- Unknown-history follow-up.
- Source or rule change affecting plan, optional.

### Reminder generation

Generate candidates from snapshots and planned actions.

Rules:

- Do not remind for `not_applicable`.
- Do not remind for `not_routinely_recommended`.
- Do not remind for insufficient-evidence items unless user explicitly opted in.
- Shared-decision reminders say “consider discussing,” not “screening overdue.”
- Clinician-managed reminders use the personal instruction.
- Avoid duplicates with stable dedupe keys.
- Respect snooze.
- Respect profile privacy.
- Respect per-profile reminder preferences.
- Do not generate external email for a private profile unless its owner configured it.

### Default cadence

Use modest defaults:

- Due soon: one reminder at threshold.
- Due now: one reminder.
- Past recommended window: periodic resurfacing no more than monthly unless user changes it.
- Appointment: user-selected reminders.
- Annual flexible item: one planning reminder.
- Unknown history: one onboarding/backfill prompt, not repeated aggressively.

### Reminder language

Good:

- “Your colorectal screening plan may be due this year.”
- “Consider discussing prostate screening at your next visit.”
- “The date of your last tetanus-containing vaccine needs confirmation.”
- “A personal clinician-plan review is coming up.”

Avoid:

- “You urgently need this.”
- “You failed to complete this.”
- “Your health score dropped.”
- Diagnosis or abnormal-result detail in email subject.

### Optional SMTP

Environment variables:

- SMTP host.
- SMTP port.
- SMTP secure mode.
- SMTP username.
- SMTP password.
- Sender address.
- Public base URL.

When absent:

- Hide email toggles or show disabled explanation.
- Keep all in-app functionality.

When present:

- Verify configuration on startup without exposing credentials.
- Send plain text and simple accessible HTML.
- Use signed deep links that still require authentication.
- Keep subject neutral.
- Record delivery status.
- Retry transient errors through the idempotent dispatch command.

### Dispatch command

`scripts/dispatch-reminders.ts`:

- Select pending reminders due through now.
- Batch.
- Lock or claim rows to avoid duplicate sends.
- Send.
- Mark sent or failed.
- Retry bounded transient failures.
- Support dry run.
- Support fixed clock.
- Log counts and IDs only, not health content.
- Exit non-zero on systemic failure.

### Preferences

Per user/profile:

- In-app enabled.
- Email enabled.
- Quiet days or quiet hours.
- Due-soon window display mode.
- Unknown-history prompts.
- Household activity detail.
- Timezone.
- Digest versus individual email, optional.

### Tests

- Dedupe prevents double reminder.
- Snooze works.
- Shared-decision copy is neutral.
- No email without SMTP.
- Private profile owner controls email.
- Dispatch is idempotent.
- Concurrent dispatch does not double-send.
- Email contains no sensitive subject.
- Deep link requires auth.
- Timezone scheduling works.

### Exit criteria

- In-app reminders work by default.
- Email is optional and safe.
- Reminder copy respects recommendation class and uncertainty.

## Part 17 — Sources center, provenance UI, rule maintenance operations, and stale-content handling

**Primary owner:** Sources Agent  
**Dependencies:** Parts 04, 06, 08, and 11  
**Owned paths:** source routes, provenance components, maintenance scripts, source documentation

### Objective

Make the source system inspectable to ordinary users and maintainable by technical operators without exposing unsafe rule-editing controls to general users.

### Sources center

Routes:

- `/app/sources`
- `/app/sources/[sourceSlug]`
- `/app/sources/services/[serviceSlug]`
- `/app/sources/changes`

The source index should show:

- Organization.
- Source title.
- Source type.
- Services using it.
- Publication or effective date.
- Last verified date.
- Freshness status.
- Active rule count.
- Attribution.

Filters:

- Organization.
- Category.
- Freshness.
- Evidence class.
- Baseline versus alternative.
- Active versus retired.

### Source detail

Show:

- Canonical link.
- Organization.
- Jurisdiction.
- Source type.
- Published/effective date.
- Last verified date.
- Content hash or abbreviated revision ID for maintainers.
- Attribution.
- Services and active rules.
- Rule versions.
- Known limitations.
- Change log.
- Cached-content status.
- External source availability.

Never present internal reviewer credentials or sensitive operational notes.

### Service provenance page

For a service, show:

- Plain-language service description.
- All active variants.
- Baseline selection.
- Conflict group.
- Eligibility summary.
- Methods.
- Rule versions.
- Source comparison.
- Retired versions.
- Profiles affected count only in local admin diagnostics, not ordinary user UI.

### Stale-source behavior

Define freshness thresholds by source class in configuration.

When stale:

- Continue deterministic evaluation from the last reviewed active rule.
- Show a non-alarmist “Source review due” badge in source detail.
- Show a subtle notice in recommendation detail when materially relevant.
- Do not disable the care plan.
- Do not silently replace the source.
- Flag maintainers in verification output.
- Never imply the source itself is invalid solely because the review date is old.

### Changed-source behavior

When external content hash changes:

- Preserve old cached payload.
- Store new payload.
- Mark change as unreviewed.
- Do not alter active rule logic.
- Show a maintainer review item.
- Require reviewed rule version or content-approval action before changing active user-facing summaries where terms require exact text.
- Record review decision.

### Maintenance commands

Provide:

- `pnpm sources:verify`
- `pnpm sources:verify --live`
- `pnpm sources:sync`
- `pnpm sources:report`
- `pnpm rules:validate`
- `pnpm rules:diff --from <version> --to <version>`
- `pnpm recommendations:rebuild --rule <stableKey>`
- `pnpm recommendations:rebuild --dry-run`

Exact command implementation can use script argument parsing, but all commands must be documented.

### Rule diff output

Show:

- Stable key.
- Old and new versions.
- Eligibility-expression differences.
- Schedule differences.
- Source metadata changes.
- Summary changes.
- Expected affected scenario IDs.
- Estimated profile count when run locally with database access.
- Whether snapshot rebuild is required.

### Maintenance safety

Do not build a web-based arbitrary JSON rule editor for version one.

Rules are reviewed as code/seed data and validated in CI. This:

- Preserves code review.
- Avoids accidental production edits.
- Keeps changes version controlled.
- Makes tests mandatory.

### Tests

- Stale source does not break evaluation.
- Changed external content does not mutate rules.
- Rule diff detects schedule changes.
- Source detail lists all variants.
- Retired rule remains inspectable.
- Source filters work.
- Attribution is present.
- Unauthorized users cannot access maintenance-only diagnostics.

### Exit criteria

- Users can understand where guidance came from.
- Maintainers can identify stale or changed sources.
- Active medical logic changes only through reviewed, versioned code.

---

## Part 18 — Security, privacy, accessibility, resilience, and performance hardening

**Primary owner:** Quality Agent  
**Dependencies:** All functional parts through Part 17  
**Owned paths:** cross-cutting hardening patches coordinated with owners, security middleware, CSP, rate limiting, accessibility tests, performance notes

### Objective

Harden the complete application against common web risks, health-data leakage, accessibility failures, and operational edge cases.

### Threat model

Document in `docs/privacy-model.md`:

Assets:

- Credentials.
- Sessions.
- Household membership.
- Profile demographics.
- Risk factors.
- Conditions.
- Medications.
- Care events.
- Clinician instructions.
- Documents.
- Exports.
- Source selections.

Threat actors:

- Unauthenticated internet user.
- Authenticated user outside the household.
- Household member without profile access.
- Household admin attempting to bypass adult privacy.
- Attacker with a stolen session.
- Malicious uploaded file.
- Malicious CSV.
- External content provider returning unsafe HTML.
- Accidental operator logging or backup exposure.

### Authentication hardening

- Argon2id parameters appropriate for the deployment target.
- Generic login errors.
- Rate limit by normalized email hash and IP prefix.
- Session rotation.
- Secure cookie flags in production.
- Same-site policy.
- Session expiration.
- Session-version invalidation.
- Password length requirements.
- Accept passphrases.
- Do not impose arbitrary low maximum password length; set a safe practical upper bound.
- Prevent credential-stuffing amplification.
- No password in logs.

### Authorization hardening

For every server action and route:

1. Authenticate.
2. Resolve household membership.
3. Resolve profile permission.
4. Validate entity belongs to authorized profile.
5. Perform mutation or read.
6. Audit when required.

Do not trust profile IDs, household IDs, document IDs, or ownership fields from the client.

Add explicit IDOR tests for:

- Profiles.
- Care events.
- Medications.
- Overrides.
- Planned actions.
- Reminders.
- Documents.
- Imports.
- Exports.
- Claim invites.

### Request and content security

Implement:

- Content Security Policy.
- `X-Content-Type-Options`.
- Referrer policy.
- Frame-ancestors or equivalent clickjacking defense.
- Permissions policy.
- HSTS in production deployment guidance.
- Safe redirect validation.
- Input length limits.
- Output escaping.
- HTML sanitization for external content.
- No secrets in client bundles.
- No sensitive IDs in analytics.
- No third-party session replay.
- No inline script exceptions unless unavoidable and nonce-protected.

### Upload hardening

- Size limits.
- MIME allowlist.
- File signature sniffing.
- Random storage key.
- Authenticated download.
- Safe content disposition.
- No user-controlled filesystem paths.
- Hash verification.
- Cleanup of partial files.
- Document virus scanning documented as unsupported in version one.
- Consider rejecting active-content PDFs only if reliably detectable; otherwise document limitations and force download.

### CSV hardening

- Parse server-side.
- Escape formula-like content on export.
- Treat all cells as data.
- Row and column limits.
- Encoding handling.
- No dynamic code.
- No raw CSV retention after successful import unless explicitly documented.

### Privacy-by-design review

Confirm:

- Household activity is redacted.
- Reminder subjects are neutral.
- Email content is minimal.
- URLs do not contain diagnoses, medication names, or service result details.
- Server logs exclude health payloads.
- Error reporting scrubs request bodies.
- Document names do not enter logs.
- Source API requests are anonymous.
- Static service worker does not cache private content.
- Exports require current authorization.
- Deleted profiles are removed from all ordinary reads.
- Backups are documented as sensitive.

### Audit logging

Audit:

- Access to exported data.
- Document downloads.
- Sharing changes.
- Profile claims.
- Deletes.
- High-risk admin operations.
- Rule activation and source review operations.

Do not audit every dashboard view if that creates excessive sensitive access logs; log profile access only where the privacy model requires it and keep metadata minimal.

### Accessibility review

Use automated and manual checks.

Pages:

- Registration.
- Sign-in.
- Onboarding.
- Overview.
- Care plan.
- Recommendation detail.
- Backfill.
- Bulk entry.
- Timeline.
- Calendar.
- Family.
- Sharing.
- Medications.
- Visit prep.
- Sources.
- Settings.
- Error.
- Offline.

Check:

- Keyboard-only flow.
- Screen-reader naming.
- Heading hierarchy.
- Focus order.
- Dialog focus.
- Error association.
- Contrast.
- Zoom to 200%.
- Reflow.
- Reduced motion.
- Touch targets.
- Print readability.
- Tables with captions and headers.
- Timeline non-visual equivalent.
- Calendar list alternative.

### Resilience

Handle:

- Database unavailable.
- External source unavailable.
- SMTP unavailable.
- Storage unavailable.
- Recommendation rebuild failure.
- Partial import failure.
- Stale session.
- Revoked access mid-session.
- Rule seed mismatch.
- Duplicate dispatch process.
- Offline browser.
- Expired invite.
- Deleted profile in open tab.

Use user-friendly errors without exposing internals.

### Performance targets

Reasonable local production targets:

- Overview query uses bounded snapshot reads.
- No N+1 source lookups.
- Family dashboard uses aggregate queries.
- Recommendation rebuild for one ordinary profile completes quickly enough for synchronous feedback.
- Large CSV import uses bounded memory and row limits.
- Images and icons optimized.
- Minimal client JavaScript for read-heavy pages.
- Lazy-load heavy timeline/calendar interactions.
- Avoid serial server fetch waterfalls.

Measure and document:

- Production bundle.
- Core route render timing.
- Database query counts for overview and family.
- Rebuild timing for demo profiles.
- Import timing at row limit.

### Tests

- Security-header tests.
- CSP smoke test.
- Rate-limit test.
- Session invalidation.
- Full IDOR suite.
- Upload spoof and traversal tests.
- CSV injection test.
- Sanitizer test.
- Service-worker cache inspection.
- Accessibility smoke tests with axe.
- Keyboard Playwright flows.
- Offline-page test.
- Database outage error test where practical.
- External source and SMTP failure tests.

### Exit criteria

- No known high-severity access-control issue.
- Private profile and document boundaries are proven by tests.
- Critical pages pass accessibility smoke tests and manual keyboard review.
- Failure modes are understandable and safe.
- Performance is acceptable for a personal/family self-hosted app.

---

## Part 19 — Automated test matrix and quality gates

**Primary owner:** Quality Agent  
**Dependencies:** Functional implementation through Part 18  
**Owned paths:** `src/test/**`, `tests/e2e/**`, test configuration, CI test reports

### Objective

Prove the medical logic, privacy boundaries, core workflows, and production build through a layered deterministic test suite.

### Test layers

#### Unit tests

Cover:

- Date ranges.
- Age calculation.
- Leap years.
- Pack-years.
- BMI derivation.
- Expression nodes.
- Schedule types.
- Event qualification.
- Due-range propagation.
- Status precedence.
- Override precedence.
- Variant selection.
- Explanation tokens.
- Reminder copy selection.
- Export escaping.
- Authorization policy functions.

#### Rule scenario tests

Every active rule needs:

- Positive scenario.
- Negative scenario.
- Boundary scenario.
- Historical completion scenario.
- Uncertainty scenario where relevant.
- Abnormal-history scenario.
- Variant scenario where relevant.

Run active rule fixtures through the same engine used in production.

#### Repository integration tests

Use an isolated PostgreSQL test database.

Cover:

- Migrations.
- Constraints.
- Transactions.
- Soft deletion.
- Idempotent seed.
- Repository query behavior.
- Snapshot rebuild.
- Import commit.
- Profile claim.
- Export authorization.
- Reminder claiming.

Do not substitute SQLite for PostgreSQL-specific behavior.

#### Service integration tests

Cover:

- Authenticated mutation.
- Authorization denial.
- Audit event.
- Rebuild trigger.
- Cache invalidation.
- Storage adapter.
- Source cache fallback.
- SMTP disabled path.
- Idempotent scripts.

#### Component tests

Cover:

- Status card.
- Approximate-date input.
- Recommendation detail.
- Source comparison.
- Backfill question.
- Bulk-entry row errors.
- Sharing control.
- Clinician override preview.
- Visit-prep selection.
- Reminder language.
- Offline banner.

#### End-to-end tests

Use Playwright against a production-like test instance.

Core journey A — New household:

1. Register.
2. Create household.
3. Add profile.
4. Complete onboarding.
5. View initial plan.
6. Start guided backfill.
7. Add exact care event.
8. See plan update.
9. Plan an action.
10. Export calendar event.
11. Print visit agenda.
12. Sign out.

Core journey B — Approximate history:

1. Sign in.
2. Open profile.
3. Add year-only event.
4. See date-confirmation status.
5. Edit to exact date.
6. See status resolve.

Core journey C — Guideline variant:

1. Open a service with conflicts.
2. Compare variants.
3. Select alternative.
4. Confirm plan changes.
5. Reset baseline.

Core journey D — Clinician plan:

1. Add exact-date override.
2. See override primary.
3. View baseline context.
4. End override.
5. See baseline restored.

Core journey E — Family privacy:

1. User A creates unclaimed profile.
2. User B claims profile.
3. User B selects owner-only.
4. User A loses access.
5. User B grants view access.
6. User A can view but not edit.
7. User B revokes access.

Core journey F — Import:

1. Download template.
2. Upload valid and invalid rows.
3. Review errors.
4. Resolve duplicate warning.
5. Commit.
6. Verify records and recalculated plan.

Core journey G — Documents:

1. Upload allowed document.
2. Link to event.
3. Download as authorized user.
4. Attempt cross-user download.
5. Confirm neutral denial.

Core journey H — Data rights:

1. Export profile.
2. Inspect ZIP manifest.
3. Delete profile.
4. Confirm ordinary access is gone.
5. Confirm session remains for household.

### Required named medical scenarios

Create stable test IDs:

- `PROSTATE_SHARED_DECISION_AGE_57`
- `MAMMOGRAPHY_VARIANT_SWITCH`
- `COLORECTAL_NEWLY_ELIGIBLE_45`
- `COLORECTAL_COLONOSCOPY_METHOD_INTERVAL`
- `LUNG_FORMER_SMOKER_WITHIN_WINDOW`
- `LUNG_FORMER_SMOKER_OUTSIDE_WINDOW`
- `YEAR_ONLY_HISTORY_UNCERTAIN`
- `NO_CERVIX_ROUTINE_EXCLUDED`
- `ABNORMAL_HISTORY_CLINICIAN_MANAGED`
- `AAA_ONE_TIME_COMPLETE`
- `CLINICIAN_OVERRIDE_PRECEDENCE`
- `PRIVATE_ADULT_PROFILE_DENIED`

### Boundary matrix

Test:

- Day before eligible birthday.
- Eligible birthday.
- Day after eligible birthday.
- Day before stop age.
- Stop-age birthday.
- February 29 birth date.
- December 31 due date.
- January 1 status transition.
- DST transition for appointments.
- Timezone date difference around UTC midnight.
- Exact interval boundary.
- Earliest approximate due boundary.
- Latest approximate due boundary.

### Security matrix

Actors:

- Anonymous.
- Authenticated stranger.
- Household member.
- Household admin.
- Profile view grantee.
- Profile edit grantee.
- Profile manager.
- Profile owner.
- Household owner.
- Former member.

Resources:

- Profile.
- Care event.
- Medication.
- Override.
- Planned action.
- Reminder.
- Document.
- Export.
- Invite.
- Activity.
- Source admin diagnostics.

Generate table-driven authorization tests.

### Accessibility matrix

At minimum run axe on:

- Auth.
- Onboarding.
- Overview.
- Care-plan detail.
- Backfill.
- Calendar.
- Family sharing.
- Visit prep.
- Sources.
- Settings.

Add manual keyboard checklist to the release handoff.

### Snapshot policy

Use visual or DOM snapshots sparingly.

Do not snapshot large pages in place of behavioral assertions. Use screenshots only for intentional visual-regression coverage of critical responsive states if the team infrastructure supports stable rendering.

### Flake control

- Fixed clock.
- Fixed timezone in tests.
- Deterministic seed.
- No live medical-source calls in normal CI.
- No live email.
- No arbitrary sleeps.
- Use explicit event waits.
- Reset database per worker or isolate schemas.
- Retry only infrastructure-flaky e2e tests, not logic failures.
- Preserve traces on first retry.

### CI gates

Required jobs:

1. Install and cache.
2. Lint.
3. Format check.
4. Type check.
5. Unit and rule tests.
6. PostgreSQL integration tests.
7. Build.
8. Playwright end-to-end.
9. Source structural verification.
10. Dependency/security audit with documented policy.

CI must fail on:

- Test failure.
- Type error.
- Lint error.
- Migration failure.
- Build failure.
- Active rule without source.
- Active rule without scenario.
- Missing required attribution.
- Unauthorized access regression.

### Exit criteria

- Core journeys pass.
- Medical scenario suite passes.
- Privacy suite passes.
- CI is repeatable without public internet.
- Test failures identify the affected rule or workflow clearly.

---

## Part 20 — Docker, CI, operations, backup, restore, and deployment documentation

**Primary owner:** Foundation Agent or Quality Agent  
**Dependencies:** Parts 00, 02, 15, 16, and 19  
**Owned paths:** Docker files, CI workflow, `.env.example`, scripts, operations docs, README deployment sections

### Objective

Make the application straightforward to run, verify, back up, restore, and self-host without paid services.

### Dockerfile

Use multi-stage build:

1. Dependency stage.
2. Build stage.
3. Minimal runtime stage.

Requirements:

- Non-root runtime user.
- Production dependencies only.
- Prisma client generated.
- Next.js standalone output if supported.
- Health check.
- Upload directory mounted.
- No secrets baked into image.
- Reproducible from lockfile.

### Docker Compose

Services:

- `db`
- `web`

Optional profile:

- Development mail catcher, only if useful and not required.

Database:

- PostgreSQL current stable supported version.
- Named volume.
- Health check.
- Credentials from environment.

Web:

- Depends on healthy database.
- Runs migration deploy on controlled startup or documented separate command.
- Private upload volume.
- Health check.
- Restart policy suitable for self-hosting.
- Configurable host port.

Do not expose PostgreSQL publicly by default.

### Environment template

Include:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST`
- `APP_BASE_URL`
- `UPLOAD_DIR`
- `MAX_UPLOAD_BYTES`
- `SOURCE_SYNC_ENABLED`
- `SOURCE_STALE_DAYS`
- `DEMO_SEED_ENABLED`
- SMTP variables.
- Rate-limit settings.
- Session-duration settings.
- Optional logging level.

For every variable, document:

- Required or optional.
- Safe local example.
- Production guidance.
- Whether changing it invalidates sessions or data.

### Health endpoint

`GET /api/health`

Return:

- Application status.
- Database connectivity.
- Storage writability using a safe probe.
- Build version.
- No secrets.
- No profile counts.
- No source details that aid attack.

Support:

- Liveness mode.
- Readiness mode if practical.

### Backup script

Back up:

- PostgreSQL database.
- Private upload volume.
- Manifest with app version and timestamp.

Requirements:

- Fail fast.
- Exclude secrets from output.
- Document encryption recommendation.
- Verify output exists and is non-empty.
- Support destination path.
- Document consistent backup sequence.

### Restore script

Restore:

- Database.
- Upload files.
- Manifest compatibility check.

Requirements:

- Explicit confirmation.
- Target environment warning.
- Backup current state first or document procedure.
- Run migrations after restore only when compatible.
- Verify health endpoint.
- Never overwrite silently.

### CI workflow

Use a PostgreSQL service container.

Steps:

- Checkout.
- pnpm setup.
- Install from lockfile.
- Generate Prisma client.
- Apply migrations.
- Seed test fixtures.
- Lint.
- Format.
- Typecheck.
- Unit and integration tests.
- Build.
- Start app.
- Playwright.
- Archive test reports on failure.

Normal CI should not make live requests to medical source websites.

### README

Required sections:

1. What CareCadence is.
2. Medical and privacy disclaimer.
3. Feature summary.
4. Screens and routes.
5. Architecture.
6. Prerequisites.
7. Quick start.
8. Local development.
9. Docker start.
10. Environment configuration.
11. Database migration.
12. Seed and demo credentials.
13. Tests.
14. Source verification.
15. Rule maintenance.
16. Reminder cron.
17. Backup.
18. Restore.
19. Updating.
20. Security notes.
21. Data export and deletion.
22. Deployment example.
23. Troubleshooting.
24. Known limitations.

### One-command developer start

Document:

```bash
cp .env.example .env
docker compose up -d db
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Also document full Docker:

```bash
cp .env.example .env
docker compose up --build
```

If migrations are not automatically run in Docker, provide the exact second command.

### Reminder cron

Document an example:

```bash
pnpm reminders:dispatch
```

and a safe cron schedule.

The command must be safe to run more than once.

### Source maintenance schedule

Document suggested operator cadence:

- Periodic source structural verification.
- Periodic live source check.
- Manual review of changed content.
- Rule version update.
- Snapshot rebuild.
- Test run.
- Deployment.

This is an operational suggestion, not an automatic medical assertion.

### Tests

- Docker image builds.
- Compose services become healthy.
- Empty database migration works.
- Seed works.
- Backup produces artifacts.
- Restore works in a disposable environment.
- Health endpoint reports dependency failure.
- App starts without SMTP.
- App starts with source sync disabled.
- Static service worker serves offline page.

### Exit criteria

- New operator can run the app from documentation.
- Backups include both database and files.
- CI reproduces release checks.
- No paid dependency is required.

---

## Part 21 — Full-system integration, demo polish, verification, and release handoff

**Primary owner:** Lead/Integrator  
**Dependencies:** All prior parts  
**Owned paths:** Cross-cutting fixes, final docs, demo data, release report

### Objective

Integrate every part into one coherent application, remove seams and dead ends, verify the complete build, and produce a truthful release handoff.

### Integration sequence

1. Rebase or merge Part 00 contracts.
2. Merge Part 01 visual system.
3. Merge Part 02 schema and migrate clean database.
4. Merge Part 03 identity and privacy.
5. Merge Parts 04–06 sources and rules.
6. Merge Parts 07–08 engine and snapshots.
7. Merge Parts 09–10 profile and records.
8. Merge Parts 11–16 product surfaces.
9. Merge Part 17 transparency.
10. Apply Parts 18–20 hardening, tests, and operations.
11. Resolve all contract mismatches centrally.
12. Run complete seed.
13. Walk all demo profiles.
14. Run all automated gates.
15. Fix every failure.
16. Perform manual desktop and mobile review.
17. Produce release report.

### Contract reconciliation checklist

Confirm:

- Status enums match database, engine, and UI.
- Date precision matches forms, imports, engine, and exports.
- Service slugs match rules and seed.
- Method IDs match event forms and schedule logic.
- Profile privacy is enforced in every query.
- Recommendation snapshots include all detail data needed by UI.
- Source IDs and rule versions resolve.
- Clinician override semantics match engine and UI.
- Activity feed receives only redacted events.
- Reminder statuses align with planning UI.
- Exports map all fields consistently.
- Soft deletion behavior is uniform.
- Audit actions use consistent names.

### Product seam review

Check every cross-feature transition:

- Onboarding → initial plan.
- Initial plan → backfill.
- Recommendation card → event form.
- Event save → recalculated card.
- Recommendation → plan action.
- Plan action → calendar.
- Calendar → appointment.
- Recommendation → clinician override.
- Override → personal plan display.
- Recommendation → source detail.
- Family card → profile.
- Profile claim → privacy selection.
- Record → document.
- Dashboard → visit prep.
- Reminder → correct profile and item.
- Export → downloadable archive.
- Delete → neutral redirect.

No route should end in a dead button or missing state.

### Demo polish

Seed a synthetic household designed to demonstrate:

- Shared and private profiles.
- Newly due screening.
- Up-to-date screening.
- Approximate-year history.
- Unknown method.
- Shared-decision item.
- One-time completed item.
- Vaccination series.
- Clinician override.
- Custom maintenance.
- Medication review.
- Planned appointment.
- Attached synthetic document metadata.
- Source conflict.
- Guideline update timeline event.

Ensure all names and data are obviously synthetic.

### Manual acceptance pass

Desktop widths:

- 1440.
- 1024.

Mobile widths:

- 390.
- 320.

Browsers:

- Chromium.
- At least one WebKit run through Playwright.
- Firefox where supported by the suite.

Review:

- Registration.
- Sign-in.
- Onboarding.
- Profile switch.
- Dashboard.
- Care-plan filters.
- Recommendation detail.
- Source comparison.
- Guided backfill.
- Bulk entry.
- CSV import.
- Timeline.
- Calendar.
- Family sharing.
- Profile claim.
- Medication.
- Override.
- Document.
- Visit prep.
- Reminder.
- Source center.
- Settings.
- Export.
- Delete.
- Offline.
- Dark mode.
- Print.

### Release commands

Run and record exact results:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm sources:verify
pnpm build
pnpm test:e2e
docker compose build
```

Also verify migrations and seed against a clean PostgreSQL database.

### Final release report

Create `docs/release-report.md` with:

- Commit or build identifier.
- Date.
- Features completed.
- Architecture summary.
- Active source count.
- Active rule count.
- Test counts.
- Commands run.
- Manual checks.
- Security and accessibility checks.
- Demo credentials.
- Deployment commands.
- Known limitations.
- Future opportunities clearly separated from version-one scope.

Do not claim:

- Medical approval.
- Clinical validation.
- HIPAA compliance.
- Zero security risk.
- Complete coverage of all preventive care.
- That source recommendations apply perfectly to every person.

### Exit criteria

- All acceptance criteria in `goal.md` and this plan are checked.
- No core TODOs.
- No placeholder screens.
- No dead actions.
- Full test and build suite passes.
- Clean Docker startup works.
- Release report is truthful.

# Implementation reference A — Status and due-date semantics

This section is normative. The engine, UI, reminders, exports, and tests must use the same meanings.

## A.1 Applicability versus timing

Determine applicability before timing.

A service may be:

- Applicable under a routine rule.
- Applicable only as shared decision.
- Selectively applicable.
- Insufficient evidence for routine use.
- Not routinely recommended.
- Inapplicable to the known profile.
- Unable to evaluate because required profile information is unknown.
- Superseded by a clinician plan.

Do not calculate an overdue date for a rule that is not routine.

## A.2 History-state semantics

Maintain these concepts even if represented across events and explanation tokens:

- `no_record`: no relevant event exists.
- `never_completed`: user explicitly reports never completed.
- `completed_exact`: qualifying event with exact day.
- `completed_month`: qualifying event with month precision.
- `completed_year`: qualifying event with year precision.
- `completed_date_unknown`: qualifying completion is known but timing is unknown.
- `unsure`: user cannot confirm completion.
- `declined`: user chose not to complete.
- `clinician_said_not_needed`: represented as override, not ordinary history.
- `not_applicable_claim`: user statement pending evidence or clinician context.
- `abnormal_history`: prior result changes pathway.

The UI may combine some concepts for display, but the engine must not erase them.

## A.3 Routine interval example

For a rule with a fixed interval:

1. Find the latest qualifying normal event.
2. If no event:
   - If user said never completed → due based on eligibility.
   - If unsure → unknown history.
   - If no record → unknown history or due based on rule design; explain the assumption.
3. Add interval to the event date range.
4. Compare due range with `asOfDate`.
5. Apply mode-specific due-soon window.
6. Apply override.
7. Return explanation.

The rule should specify whether absence of history means “due on eligibility” or “history needed.” Do not apply one global assumption to every service.

## A.4 One-time example

- No qualifying event and eligible → due or discuss based on class.
- Qualifying normal event exists → completed once.
- Event date unknown but completion known → completed once if timing does not affect eligibility.
- Abnormal event → clinician-managed.
- User unsure whether completed → unknown history.
- Repeat only if a separate risk rule or clinician override applies.

## A.5 Method-dependent example

- If no event → offer accepted method choices.
- If latest event method is known → use that method’s interval.
- If method is unknown → needs method confirmation.
- If result is unknown and the active rule requires normal result → needs confirmation or clinician-managed.
- If user changes method for the next screening, the next interval is based on the method actually completed, not merely planned.

## A.6 Series example

For vaccines:

- Sort valid doses chronologically.
- Respect minimum intervals.
- A dose too early does not automatically count when source logic says it is invalid.
- Approximate dates may make dose validity uncertain.
- Generate next-dose range.
- Completed series should not recur unless booster logic applies.
- Product-specific behavior only when required.
- Do not infer contraindications.

## A.7 Seasonal example

- Determine local season by profile timezone and year.
- If current season and no qualifying event → due this season.
- If event completed this season → up to date.
- If outside season → future.
- Preserve source addenda and annual version.
- Do not hardcode a perpetual product formulation.

## A.8 Shared decision

A shared-decision item should show:

- Conversation window.
- Why the profile is in that window.
- Benefits and limitations.
- Questions for clinician.
- Source.
- Optional conversation history.
- Personal clinician plan if entered.

It should not show:

- Automatic overdue.
- Mandatory recurring test.
- Shame language.
- A red failure state.

## A.9 Selective recommendation

A selective item should show:

- Factors that may increase or decrease relevance.
- Source class.
- Why individual judgment matters.
- A “Discuss” action.
- No automatic reminder unless user opts in or clinician plan exists.

## A.10 Insufficient evidence

An insufficient-evidence item:

- May appear in Extra-attentive mode or relevant detail.
- Must be labeled clearly.
- Must not contribute to completion percentage.
- Must not be overdue.
- Must not produce default reminders.
- May support a custom reminder after explicit user choice.

## A.11 Recommendation against routine use

A not-recommended item:

- Appears only when relevant for transparency.
- Must not create a due task.
- Must not create a reminder.
- Must explain the population and source.
- May still show a clinician override.
- Must not block a user from recording historical care.

## A.12 Clinician-managed status

Triggers include:

- Abnormal result.
- Inconclusive result where routine interval cannot be safely applied.
- Prior disease.
- High-risk history outside average-risk rule.
- Explicit clinician override.
- Surgery/history requiring individualized follow-up.

Primary copy:

> Routine screening timing may no longer apply. Follow the personal plan from your clinician.

Actions:

- Add clinician instruction.
- Add follow-up appointment.
- Record care.
- View baseline guideline context.

## A.13 Declined and snoozed

Declined:

- Record decision and date.
- Keep underlying recommendation visible.
- Do not mark completed.
- Do not shame.
- Offer reminder preferences.
- Allow reversal.

Snoozed:

- Affects reminder surfacing.
- Does not affect medical status.
- Shows snooze-until date in details.
- Automatically resurfaces.

## A.14 Completion percentage

Include:

- Routine actionable items currently relevant.
- One-time items until completed.
- Series doses currently actionable.

Exclude:

- Future items.
- Not applicable.
- Not routinely recommended.
- Insufficient evidence.
- Shared decision unless the completion event is a recorded discussion and product design explicitly includes it.
- Clinician-managed items without a defined personal action.
- Custom templates not adopted.
- Unknown profile-information prompts from the denominator until the necessary data is supplied.

Display denominator explanation.

---

# Implementation reference B — Server actions and route handlers

All inputs use Zod. All writes authorize server-side. All successful relevant writes audit and trigger revalidation/rebuild.

## B.1 Authentication actions

- `registerUser`
- `signInWithCredentials`
- `signOutCurrentSession`
- `changePassword`
- `signOutAllSessions`
- `requestPasswordReset`
- `completePasswordReset`
- `deleteAccount`

## B.2 Household actions

- `createHousehold`
- `updateHousehold`
- `inviteHouseholdMember`
- `revokeHouseholdInvite`
- `acceptHouseholdInvite`
- `updateHouseholdMemberRole`
- `removeHouseholdMember`
- `leaveHousehold`
- `transferHouseholdOwnership`

## B.3 Profile actions

- `createProfile`
- `updateProfileBasics`
- `updateProfileAnatomy`
- `updateProfileRiskFactors`
- `updateProfileConditions`
- `updateProfileFamilyHistory`
- `updateProfileSurgeries`
- `updateCarePlanMode`
- `deleteProfile`
- `restoreProfile`, only if recovery is supported
- `grantProfileAccess`
- `revokeProfileAccess`
- `changeProfileVisibility`
- `sendProfileClaimInvite`
- `revokeProfileClaimInvite`
- `acceptProfileClaim`

## B.4 Guideline selection actions

- `selectGuidelineVariant`
- `resetGuidelineVariantToBaseline`

Both must show a before/after preview or return changed recommendations.

## B.5 Care event actions

- `createCareEvent`
- `updateCareEvent`
- `deleteCareEvent`
- `restoreCareEvent`
- `answerBackfillQuestion`
- `skipBackfillQuestion`
- `resetBackfillProgress`

## B.6 Medication actions

- `createMedication`
- `updateMedication`
- `endMedication`
- `deleteMedication`
- `createMedicationReviewReminder`

## B.7 Override and custom-plan actions

- `createClinicianOverride`
- `updateClinicianOverride`
- `endClinicianOverride`
- `createCustomMaintenance`
- `updateCustomMaintenance`
- `disableCustomMaintenance`
- `adoptMaintenanceTemplate`

## B.8 Planning actions

- `createPlannedAction`
- `updatePlannedAction`
- `cancelPlannedAction`
- `completePlannedActionByRecordingEvent`
- `snoozeRecommendation`
- `cancelSnooze`
- `createReminder`
- `dismissReminder`
- `updateReminderPreferences`

## B.9 Visit-prep actions

- `saveVisitPrepPreferences`
- `addVisitQuestion`
- `updateVisitQuestion`
- `deleteVisitQuestion`
- `reorderVisitQuestions`

## B.10 Route handlers

### Public/system

- `GET /api/health`
- `GET /manifest.webmanifest`, static
- `GET /sw.js`, static

### Uploads and documents

- `POST /api/profiles/:profileId/documents`
- `GET /api/documents/:documentId`
- `DELETE /api/documents/:documentId`

### CSV

- `GET /api/profiles/:profileId/import/template`
- `POST /api/profiles/:profileId/import/preview`
- `POST /api/profiles/:profileId/import/commit`

### Exports

- `GET /api/profiles/:profileId/export`
- `GET /api/households/:householdId/export`
- `GET /api/planned-actions/:id/calendar.ics`
- `GET /api/profiles/:profileId/calendar.ics`

### Sources

- `POST /api/internal/sources/sync`, protected by local admin secret or disabled by default
- Prefer command-line scripts over a remotely exposed source-sync route.

### Reminders

- `POST /api/internal/reminders/dispatch`, optional and protected
- Prefer command-line cron unless the deployment requires HTTP cron.

## B.11 Mutation response behavior

On validation error:

- Return field errors.
- Preserve user input.
- Do not rebuild.

On authorization failure:

- Return neutral not-found or generic denial.
- Do not reveal entity ownership.

On database conflict:

- Return actionable message.
- Preserve idempotency.

On rebuild failure after a transactional write:

- Roll back the write where practical.
- If asynchronous rebuild is ever introduced later, show stale state explicitly; version one should prefer synchronous consistency for profile-sized data.

---

# Implementation reference C — Page contracts and complete state coverage

Every page must implement loading, empty, populated, error, unauthorized, and narrow-screen behavior where applicable.

## C.1 Public home

Purpose:

- Explain the product.
- Explain privacy-conscious self-hosting.
- Explain that it is not medical advice.
- Link to register and sign in.

Do not show fabricated testimonials or clinical endorsements.

## C.2 Registration

Fields:

- Name.
- Email.
- Password.
- Password confirmation.
- Terms/privacy acknowledgment for local app behavior.

States:

- Validation errors.
- Existing email generic handling.
- Rate limit.
- Success redirect.
- SMTP disabled note only when verification is relevant.

## C.3 Sign-in

Fields:

- Email.
- Password.
- Remember/session duration only if implemented safely.

States:

- Generic failure.
- Rate limit.
- Expired session return.
- Password reset availability.

## C.4 No-household state

Show:

- Create household.
- Accept pending invite.
- Product explanation.
- No empty navigation to inaccessible profile pages.

## C.5 No-profile state

Show:

- Add myself.
- Add family member.
- Explain adult privacy and claiming.
- Link to household settings.

## C.6 Onboarding

Must preserve progress.

Show:

- Step title.
- Why asked.
- Privacy note.
- Progress.
- Save/continue.
- Save/exit.
- Skip optional.
- Validation.
- Back.

## C.7 Overview

Must show:

- Active profile.
- Care-plan mode.
- Next actions.
- Annual summary.
- Unknown history.
- Visit prep.
- Recent profile activity.
- Source freshness notice only if materially relevant.

## C.8 Care plan

Must show:

- Search.
- Filters.
- Grouped list.
- Compact list option.
- Status definitions.
- Empty filtered state.
- Print summary.
- Mode switch.

## C.9 Recommendation detail

Must show all provenance and calculation sections from Part 11.

## C.10 Timeline

Must show:

- Approximate-date visual treatment.
- Non-visual list equivalent.
- Filters.
- Future milestones.
- Guideline updates.
- Empty history state.

## C.11 Calendar

Must show:

- Month/agenda/year.
- Anytime-this-year bucket.
- Planned versus medical timing distinction.
- Keyboard-accessible planning.
- Export.

## C.12 Records

Must show:

- History list.
- Add event.
- Guided backfill.
- Bulk entry.
- CSV import.
- Missing dates.
- Documents.
- Filters.

## C.13 Backfill

Must show:

- Personalized queue.
- Question count.
- Skip.
- Save progress.
- Why asked.
- Method follow-up.
- Approximate date.
- Completion summary.

## C.14 Medications

Must show:

- Active/paused/ended.
- Review dates.
- Monitoring instructions.
- Privacy note.
- No inferred advice.

## C.15 Family

Must show:

- Visible profiles only.
- Invites.
- Claims.
- Sharing status.
- Redacted activity.
- Household settings.

## C.16 Visit prep

Must show:

- Section selection.
- Questions.
- Print preview.
- Copy.
- Calendar.
- Privacy warning.
- Concise and extended modes.

## C.17 Sources

Must show:

- Source index.
- Freshness.
- Services.
- Variants.
- Source detail.
- Attribution.
- Change history.

## C.18 Settings

Sections:

- Account.
- Security.
- Household.
- Profile privacy.
- Reminders.
- Appearance.
- Data export.
- Deletion.
- Source preferences only where user-selectable.

## C.19 Error states

Use specific, safe messages:

- Could not save.
- Could not rebuild care plan.
- Source content temporarily unavailable.
- Storage unavailable.
- Session expired.
- Access changed.
- Import contains errors.
- No connection.

Never display stack traces, raw SQL, rule JSON, health payloads, or file paths.

---

# Implementation reference D — Medical and privacy copy guide

Copy is part of product correctness.

## D.1 Persistent disclaimer

Use:

> CareCadence organizes preventive-care information and personal records. It does not diagnose conditions, replace medical advice, or determine whether a specific test is safe or appropriate for you.

Place:

- Public home.
- App Help/About.
- Visit-prep print footer.
- Relevant recommendation detail footer.

Keep it unobtrusive on ordinary screens.

## D.2 Abnormal result

Use:

> Routine screening timing may no longer apply. Follow the personal plan from your clinician.

Do not use:

- “This result means…”
- “You probably have…”
- “You should begin treatment…”
- “Repeat in X months” unless entered as clinician instruction.

## D.3 Unknown history

Use:

- “We do not have a date for your last screening.”
- “Confirming the method and date will make this plan more accurate.”
- “You can enter an exact date, a month, a year, or say you are not sure.”

Do not use:

- “You missed this.”
- “You failed to record this.”
- “Overdue” when history is simply missing.

## D.4 Due language

Preferred:

- Recommended this year.
- Due soon.
- Due now.
- Past the recommended window.
- Consider discussing.
- Follow personal clinician plan.
- Date needs confirmation.

Avoid:

- Noncompliant.
- Failed.
- Neglected.
- Dangerous delay.
- Mandatory, unless a user is describing their own requirement outside the medical context.

## D.5 Extra-attentive mode

Use:

> Extra-attentive mode surfaces more planning prompts, specialty guideline alternatives, and optional health-maintenance discussions. It does not mean that more testing is always better.

## D.6 Guideline differences

Use:

> Reputable organizations sometimes recommend different starting ages, intervals, or methods. Selecting a variant changes how CareCadence organizes your plan; it does not replace a decision with your clinician.

## D.7 Custom labs

Use:

> This is a personal or clinician-defined lab plan, not a universal annual screening requirement.

## D.8 Anatomy question

Use:

> Some preventive-care recommendations depend on which organs or tissue a person currently has, especially after surgery or gender-affirming care.

Options must include unsure and prefer not to answer.

## D.9 Tobacco and weight

Use neutral factual language.

Examples:

- “Smoking history can affect whether certain screening guidance applies.”
- “Height and weight can affect some preventive recommendations. You may skip this.”

Do not use moralizing copy.

## D.10 Privacy

Use:

> Adult profiles can remain private even within a household. Sharing is explicit and can be changed at any time.

When claiming:

> Accepting this profile makes you its owner. The person who created it will keep access only if you choose to share it.

## D.11 Reminder subjects

Allowed:

- Care plan reminder.
- Appointment reminder.
- Medication review reminder.
- Personal care-plan review.

Avoid service or diagnosis details in email subjects by default.

## D.12 Source freshness

Use:

> This rule is based on the last reviewed source version shown below. A source review is due.

Do not say:

- “This recommendation is outdated” unless review confirms that.
- “Unsafe.”
- “Invalid.”

---

# Implementation reference E — Synthetic demo household

Seed a polished demo that exercises the whole product.

## E.1 Demo user

- Name: `Demo Organizer`
- Email: configured by `DEMO_USER_EMAIL`
- Password: configured by `DEMO_USER_PASSWORD`
- Clearly labeled as synthetic in UI.
- Never enable demo credentials by default in production.

## E.2 Household

- Name: `Demo Family`
- Country: US.
- Timezone: configurable default, such as America/New_York.
- Four profiles.

## E.3 Profile A — Shared 57-year-old with prostate

Purpose:

- Shared-decision prostate item.
- Colorectal method history.
- Approximate vaccination history.
- Clinician override.

Data:

- Age 57 at the fixed demo scenario date.
- Prostate present.
- No prior prostate cancer.
- Normal colonoscopy with an exact date that remains up to date.
- Tetanus-containing vaccine year only, producing date uncertainty.
- Clinician-defined medication review.
- Planned annual visit.

Expected:

- PSA conversation, not annual overdue PSA.
- Colonoscopy interval based on colonoscopy method.
- Vaccine date-confirmation prompt.
- Personal medication review visible.

## E.4 Profile B — Shared 62-year-old mammography-eligible adult

Purpose:

- Guideline conflict.
- Approximate mammogram.
- Bone-health future milestone.
- Family history.

Data:

- Relevant breast anatomy present.
- Cervix state captured.
- Mammogram year only.
- Federal baseline selected initially.
- Specialty variant available.
- First-degree family history example without claiming a genetic syndrome.
- Current preventive appointment planned.

Expected:

- Guideline comparison.
- Due uncertainty from year-only event.
- Variant switch visibly changes schedule.
- Family dashboard counts.

## E.5 Profile C — Shared 45-year-old average-risk adult

Purpose:

- Newly eligible colorectal screening.
- No history.
- Guided backfill.
- CSV import.

Data:

- No colorectal event.
- Minimal risk factors.
- One exact vaccine record.
- One custom dental cadence.
- One synthetic attached PDF metadata record.

Expected:

- Actionable colorectal recommendation.
- Method choice.
- Backfill queue.
- Maintenance item clearly labeled custom.

## E.6 Profile D — Claimed private adult

Purpose:

- Privacy testing.
- Sharing grant.
- Sensitive activity redaction.

Data:

- Owner-only visibility.
- A mental-health screening record.
- A medication.
- A clinician-managed event.
- No detailed household activity.

Expected:

- Organizer cannot access.
- Profile owner can grant view-only.
- Sensitive data never appears in household feed.

## E.7 Timeline events

Seed:

- Exact event.
- Month-only event.
- Year-only event.
- Unknown-date completion.
- Planned action.
- Clinician override.
- Guideline variant selection.
- Synthetic rule-update event.
- Document attachment.
- Profile claim.

## E.8 Demo safeguards

- Names must be obviously synthetic.
- Notes must not resemble real patient narratives.
- Documents must contain synthetic placeholder content generated for the demo.
- No real clinician names.
- No real contact details.
- Demo mode banner.
- Production startup warns or blocks when default demo credentials remain enabled.

---

# Implementation reference F — Agent start and finish checklists

## F.1 Start checklist for every agent

- Read `goal.md`.
- Read relevant plan parts.
- Pull latest integration branch.
- Run `pnpm install --frozen-lockfile`.
- Run targeted baseline tests.
- Confirm owned paths.
- Inspect prerequisite handoffs.
- Confirm contracts.
- Use fixed-clock fixtures.
- Use synthetic data.
- Avoid unrelated refactors.

## F.2 During-work checklist

- Validate all external input.
- Authorize all private access.
- Use transactions for coupled writes.
- Trigger recommendation rebuild where required.
- Add audit event where required.
- Revalidate cache.
- Handle loading, empty, error, and unauthorized states.
- Add unit/integration tests.
- Keep copy neutral.
- Preserve date precision.
- Preserve source provenance.
- Avoid health data in logs.
- Avoid package additions without need.

## F.3 Finish checklist

- Run formatter.
- Run lint on changed paths.
- Run typecheck.
- Run targeted tests.
- Run build if shared code changed.
- Search changed files for `TODO`, `FIXME`, placeholder text, and console logging.
- Verify no secrets.
- Verify no real health data.
- Update handoff.
- Commit intentionally.
- Note any proposed shared-contract change.

## F.4 Lead merge checklist

- Review contract changes.
- Review migrations.
- Review source/rule metadata.
- Run affected tests.
- Resolve duplicated components.
- Recheck authorization.
- Recheck copy.
- Recheck mobile.
- Recheck source attribution.
- Rebuild demo seed.
- Update release report.

---

# Implementation reference G — Final acceptance checklist

Check every item before release.

## G.1 Installation and environment

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `.env.example` is complete.
- [ ] Invalid environment fails with a useful message.
- [ ] App starts without SMTP.
- [ ] App starts with source sync disabled.
- [ ] PostgreSQL is not publicly exposed by default.
- [ ] Docker image runs as non-root.
- [ ] Upload volume is private.
- [ ] Health endpoint works.

## G.2 Database

- [ ] Migration applies to empty database.
- [ ] Seed applies.
- [ ] Seed is idempotent.
- [ ] Date constraints work.
- [ ] Soft deletion works.
- [ ] Indexes exist.
- [ ] Transactions roll back.
- [ ] Backup works.
- [ ] Restore works.

## G.3 Identity and privacy

- [ ] Registration works.
- [ ] Sign-in works.
- [ ] Sign-out works.
- [ ] Password change works.
- [ ] Sign out all devices works.
- [ ] Rate limiting works.
- [ ] Household creation works.
- [ ] Invites work.
- [ ] Roles work.
- [ ] Profile claiming works.
- [ ] Owner-only profile works.
- [ ] Selected sharing works.
- [ ] Whole-household sharing works.
- [ ] Access revocation is immediate.
- [ ] IDOR tests pass.
- [ ] Private documents are protected.
- [ ] Private exports are protected.

## G.4 Profile and onboarding

- [ ] Adult age validation works.
- [ ] Timezone works.
- [ ] Anatomy fields work.
- [ ] Unknown anatomy works.
- [ ] Tobacco history works.
- [ ] Pack-years work.
- [ ] Height and weight are optional.
- [ ] Conditions work.
- [ ] Family history works.
- [ ] Surgeries update anatomy.
- [ ] Medications are optional.
- [ ] Onboarding resumes.
- [ ] Initial plan generates.
- [ ] Profile edit rebuilds plan.

## G.5 Rules and sources

- [ ] Every active rule has source.
- [ ] Every active rule has scenario.
- [ ] Rule versions are immutable.
- [ ] Conflict baseline exists.
- [ ] Variant selection works.
- [ ] Source detail works.
- [ ] Last verified date shows.
- [ ] Attribution shows.
- [ ] Stale source shows review notice.
- [ ] Source change does not auto-change logic.
- [ ] Cached fallback works.
- [ ] Normal CI works offline.
- [ ] No external content sends PII.

## G.6 Engine

- [ ] Deterministic output.
- [ ] Explicit `asOfDate`.
- [ ] Age boundaries.
- [ ] Leap years.
- [ ] Timezones.
- [ ] Method-specific intervals.
- [ ] One-time completion.
- [ ] Dose series.
- [ ] Seasonal schedule.
- [ ] Shared decision.
- [ ] Selective recommendation.
- [ ] Insufficient evidence.
- [ ] Recommendation against.
- [ ] Unknown history.
- [ ] Approximate date.
- [ ] Abnormal history.
- [ ] Clinician override.
- [ ] Variant selection.
- [ ] Explanation tokens.
- [ ] Stable sorting.

## G.7 Records and backfill

- [ ] Create event.
- [ ] Edit event.
- [ ] Delete event.
- [ ] Exact date.
- [ ] Month precision.
- [ ] Year precision.
- [ ] Unknown date.
- [ ] Never completed.
- [ ] Unsure.
- [ ] Guided queue.
- [ ] Method follow-up.
- [ ] Bulk entry.
- [ ] CSV template.
- [ ] CSV preview.
- [ ] Duplicate warning.
- [ ] Transactional commit.
- [ ] Plan recalculation.
- [ ] Abnormal-result safety copy.

## G.8 Dashboard and care plan

- [ ] Next actions are clear.
- [ ] Counts are correct.
- [ ] Completion denominator is explained.
- [ ] Needs-attention section.
- [ ] This-year section.
- [ ] Coming-up section.
- [ ] Unknown-history section.
- [ ] Up-to-date section.
- [ ] Discussion section.
- [ ] Filters.
- [ ] Search.
- [ ] Recommendation details.
- [ ] Exact calculation.
- [ ] Source provenance.
- [ ] Guideline comparison.
- [ ] Mode switch.
- [ ] No overstatement.

## G.9 Timeline and calendar

- [ ] Historical events.
- [ ] Approximate dates.
- [ ] Current statuses.
- [ ] Future milestones.
- [ ] Stop-age milestones.
- [ ] Guideline updates.
- [ ] Annual roadmap.
- [ ] Anytime-this-year bucket.
- [ ] Planned month.
- [ ] Appointment.
- [ ] Snooze.
- [ ] `.ics` export.
- [ ] Keyboard calendar alternative.

## G.10 Family

- [ ] Visible profile cards.
- [ ] Private profiles hidden.
- [ ] Aggregate counts authorized.
- [ ] Redacted activity.
- [ ] Sensitive activity excluded.
- [ ] Invite management.
- [ ] Claim management.
- [ ] Sharing controls.
- [ ] Mobile layout.

## G.11 Medications and personal plans

- [ ] Medication CRUD.
- [ ] Medication privacy.
- [ ] No inferred monitoring.
- [ ] Exact-date override.
- [ ] Recurring override.
- [ ] Supplemental override.
- [ ] No-longer-needed override.
- [ ] Override ending.
- [ ] Custom maintenance.
- [ ] Custom lab warning.
- [ ] Template adoption.

## G.12 Documents and exports

- [ ] PDF upload.
- [ ] JPEG upload.
- [ ] PNG upload.
- [ ] MIME spoof rejection.
- [ ] Size rejection.
- [ ] Authenticated download.
- [ ] Safe filename.
- [ ] Blob deletion.
- [ ] Event link.
- [ ] Visit agenda.
- [ ] Print.
- [ ] Clipboard.
- [ ] Profile ZIP.
- [ ] Household ZIP.
- [ ] Private profile omission.
- [ ] Account deletion.

## G.13 Reminders

- [ ] In-app reminder.
- [ ] Due-soon reminder.
- [ ] Shared-decision copy.
- [ ] Clinician-plan reminder.
- [ ] Snooze.
- [ ] Dismiss.
- [ ] Dedupe.
- [ ] Timezone.
- [ ] SMTP-disabled state.
- [ ] SMTP send.
- [ ] Neutral email subject.
- [ ] Idempotent dispatch.
- [ ] Concurrent dispatch protection.

## G.14 UI and accessibility

- [ ] Light mode.
- [ ] Dark mode.
- [ ] Desktop.
- [ ] Tablet.
- [ ] Mobile 390px.
- [ ] Mobile 320px.
- [ ] Loading states.
- [ ] Empty states.
- [ ] Error states.
- [ ] Offline state.
- [ ] Visible focus.
- [ ] Keyboard navigation.
- [ ] Dialog focus.
- [ ] Accessible forms.
- [ ] Contrast.
- [ ] Reduced motion.
- [ ] 200% zoom.
- [ ] Print readability.
- [ ] Axe smoke tests.

## G.15 Security and operations

- [ ] Secure cookies.
- [ ] CSRF defenses.
- [ ] CSP.
- [ ] Security headers.
- [ ] Rate limits.
- [ ] Safe redirects.
- [ ] Input limits.
- [ ] Sanitized external HTML.
- [ ] No health data in logs.
- [ ] No session replay.
- [ ] Static-only service-worker cache.
- [ ] Audit events.
- [ ] Backup docs.
- [ ] Restore docs.
- [ ] Source maintenance docs.
- [ ] Reminder cron docs.

## G.16 Build gates

- [ ] Format passes.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Unit tests pass.
- [ ] Rule scenarios pass.
- [ ] Integration tests pass.
- [ ] End-to-end tests pass.
- [ ] Source structural verification passes.
- [ ] Production build passes.
- [ ] Docker build passes.
- [ ] Clean-database smoke test passes.
- [ ] Release report complete.

---

# Known version-one limitations to state explicitly

The final product should disclose at least these limitations:

- United States guidance only.
- Adults age 18 and older only.
- No diagnosis or treatment.
- No personalized medical clearance.
- No result interpretation.
- No pediatric or prenatal schedules.
- No EHR or pharmacy integration.
- No OCR or automatic record extraction.
- Manual or CSV history entry.
- Guideline rules require human review and maintenance.
- External consumer content may temporarily use a cached copy.
- Optional email requires SMTP and an external cron mechanism.
- Local file storage requires operator backup.
- Uploaded files are not virus-scanned in version one.
- No claim of HIPAA compliance.
- Specialty guideline coverage is intentionally selective.
- Not every individual risk factor or rare condition is modeled.
- Clinician instructions remain the authoritative personal plan.
