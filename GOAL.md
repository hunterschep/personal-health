# Goal

Build **CareCadence**, a complete, production-ready, self-hostable web application for tracking preventive health, routine checkups, vaccinations, screenings, labs, medications, and clinician-defined care cadences for multiple adults in a household.

Treat `plan.md` as the detailed implementation specification and execute it end to end.

## Delivery standard

- Complete the product in one implementation pass.
- Do not stop at scaffolding, wireframes, pseudocode, placeholder data, dead buttons, or TODO comments.
- Resolve ordinary ambiguities with the defaults in `plan.md`; do not pause for product questions.
- Use synthetic data only in demos, fixtures, screenshots, and tests.
- Run migrations, seed data, lint, type checks, unit tests, integration tests, end-to-end tests, and the production build.
- Fix all failures before declaring completion.
- Document any genuine remaining limitation explicitly.

## Product outcome

- A user can register, sign in, create a household, and add multiple adult profiles.
- A profile can represent the user, a parent, a spouse, or another adult family member.
- Onboarding captures age, sex assigned at birth, optional gender identity, relevant anatomy, risk factors, conditions, family history, surgeries, medications, and clinician instructions.
- The app immediately generates a personalized preventive-care plan.
- The plan shows what is due now, due this year, coming later, up to date, uncertain, clinician-managed, or appropriate for discussion.
- Users can backfill exact or approximate historical care without invented precision.
- Users can record new care, upload private documents, plan appointments, export calendar events, and print a doctor-visit agenda.
- Household members can switch profiles without crossing privacy boundaries.

## Medical logic

- All eligibility, cadence, status, and due-date decisions must come from a deterministic, versioned, testable rules engine.
- Do not use an LLM to decide whether a service applies or when it is due.
- Calculate age from date of birth and an explicit `asOfDate`; never store static age.
- Use relevant anatomy and surgery history instead of relying only on a binary sex field.
- Treat unknown history, never completed, approximate date, exact date, declined, not applicable, and clinician-managed as distinct states.
- Never invent a month or day when the user knows only a year.
- If a historical date range creates uncertainty, show a due range and ask the user to confirm the date.
- A prior abnormal result, cancer history, or clinician follow-up plan must leave the routine average-risk pathway unless a vetted rule explicitly covers it.
- A clinician override takes precedence while the general guideline remains visible for context.
- Conflicting reputable guidelines remain separate source variants; never blend them into an opaque average.
- Extra-attentive mode may surface more conversations and specialty alternatives, but it must not label unsupported testing as required.
- Do not present a universal annual blood panel as medically necessary.
- Individual labs become due only through a source-backed rule, condition plan, medication-monitoring plan, clinician override, or custom reminder.

## Sources and rule governance

- Support United States adult preventive-care guidance for version one.
- Seed useful, source-backed rules for cancer screening, cardiometabolic screening, infectious disease, bone and vascular health, behavioral health, and adult immunization.
- Use current primary guidance from USPSTF, CDC/ACIP, HRSA-supported sources, and MyHealthfinder.
- Use specialty organizations only as clearly labeled alternatives.
- Store source organization, title, URL, publication or effective date, last verification date, evidence class, and rule version.
- Maintain a source registry, stale-source checks, sync logs, and a cached fallback.
- Use MyHealthfinder only for eligible anonymous profile inputs and never transmit names, identifiers, free-text notes, medications, or attachments.
- Preserve required attribution and source text boundaries for imported consumer content.
- Never turn scraped prose directly into active medical logic without a reviewed rule record.
- Include a maintenance guide for adding, versioning, testing, retiring, and re-evaluating rules.

## Initial care catalog

- Include method-aware colorectal screening.
- Include separate federal and specialty mammography variants.
- Include separate federal and specialty cervical-screening variants.
- Include prostate screening as shared decision-making where appropriate rather than an automatic annual task.
- Include risk-based lung screening.
- Include skin-health discussion or custom maintenance without overstating evidence.
- Include blood pressure, diabetes or prediabetes, lipids and cardiovascular-risk review, BMI, tobacco, alcohol, activity, and nutrition items.
- Include osteoporosis, abdominal aortic aneurysm, hepatitis C, HIV, risk-based hepatitis B, and risk-based STI services.
- Include depression, anxiety, fall risk, hearing, cognition, function, and safety items with the correct evidence or discussion labels.
- Include adult influenza, COVID, Tdap or Td, shingles, pneumococcal, RSV, HPV, hepatitis A, hepatitis B, MMR, and varicella logic.
- Include editable maintenance templates for primary care, dental, vision, hearing, skin, medications, advance care planning, specialist follow-up, and custom labs.

## Core experiences

- Build progressive profile onboarding with immediate plan generation.
- Build a guided personalized backfill queue.
- Build bulk history entry and validated CSV import with preview, duplicate detection, and clear errors.
- Support exact date, month and year, year only, date unknown, never completed, unsure, and skipped answers.
- Recalculate recommendations immediately after relevant profile, history, rule, or override changes.
- Build a premium overview dashboard focused on the next actions.
- Build sections for needs attention, this year, coming up, unknown history, up to date, and discuss with a clinician.
- Build an annual roadmap with exact-month and anytime-this-year items.
- Build recommendation cards and a complete recommendation detail view.
- Show the rule, source, eligibility facts, due calculation, accepted methods, history, limitations, and competing variants.
- Build a longitudinal timeline with past events, current items, future milestones, stop ages, rule changes, and clinician overrides.
- Build a calendar and planning experience with planned month, exact appointment date, snoozing, and `.ics` export.
- Build a family dashboard with per-profile summaries and privacy-aware activity.
- Build medication tracking and clinician-defined monitoring plans without inferring arbitrary medical schedules.
- Build private document attachments and authenticated downloads.
- Build a printable one-page doctor-visit agenda and copyable summary.
- Build an in-app reminder center; make email reminders optional when SMTP is configured.
- Build source and guideline pages that make provenance easy to inspect.
- Build light mode, dark mode, responsive desktop, responsive mobile, loading, empty, error, and offline states.

## Privacy and safety

- Treat all health information as sensitive even for personal use.
- Implement secure HTTP-only sessions, CSRF defenses, authentication rate limits, Argon2id password hashing, and server-side authorization.
- Enforce household and profile access on every read, mutation, export, and attachment route.
- Support private adult profiles and explicit sharing.
- Keep uploads outside public static storage and validate file type and size.
- Do not place health details in analytics, logs, URLs, notification subjects, or third-party session replay.
- Record audit events for access, edits, exports, sharing, and deletion.
- Support household export, profile export, profile deletion, and account deletion.
- Do not claim HIPAA compliance.
- Display a clear statement that the app organizes preventive-care information and does not diagnose, treat, or replace clinical advice.
- Do not interpret abnormal results or recommend treatment.
- Use neutral reminder language and avoid fear, shame, or a health score.

## Interface direction

- The product should feel calm, modern, confident, and premium rather than like a hospital portal or spreadsheet.
- Use spacious layouts, strong typography, restrained status color, rounded surfaces, clear labels, and subtle motion.
- Use accessible contrast, semantic HTML, visible focus states, keyboard navigation, form labels, and helpful validation.
- Avoid generic medical photography, excessive red, cartoon gamification, confetti, dense tables as the default view, and ambiguous icon-only actions.

## Technical implementation

- Use a current stable Next.js App Router stack with strict TypeScript.
- Use Tailwind CSS, shadcn/ui, Lucide icons, React Hook Form, Zod, and date-fns.
- Use PostgreSQL with Prisma and committed migrations.
- Use Auth.js credentials authentication with Argon2id.
- Use Vitest for unit and integration tests and Playwright for end-to-end tests.
- Use Docker and Docker Compose with a private persistent upload volume.
- Use pnpm and commit the lockfile.
- Include a PWA manifest and graceful offline shell behavior.
- Make the application fully usable without a paid external service.
- Include `.env.example`, health-check endpoint, seed command, demo household, Dockerfile, compose file, CI workflow, and production README.

## Required domain model

- Implement users, sessions, households, memberships, invitations, profiles, anatomy, risks, conditions, family history, surgeries, and medications.
- Implement service catalog, service methods, source registry, guideline rules, care events, clinician overrides, recommendation snapshots, plans, and reminders.
- Implement documents, document links, audit logs, and source sync logs.
- Use UUIDs, timestamps, transactional writes, indexes, and soft deletion where appropriate.
- Keep care events and rule versions as source of truth; recommendation instances are rebuildable snapshots.

## Verification scenarios

- Verify a 57-year-old person with a prostate receives a PSA discussion item rather than an automatically overdue annual test.
- Verify a mammography-eligible profile can compare and select distinct source variants.
- Verify an average-risk 45-year-old with no colorectal history receives an actionable screening recommendation.
- Verify the selected colorectal method controls the future interval.
- Verify a normal colonoscopy is not evaluated using a stool-test interval.
- Verify lung eligibility responds to age, pack-years, smoking status, and quit timing.
- Verify year-only history produces uncertainty rather than an invented date.
- Verify a person without a cervix does not receive routine cervical screening unless clinician-managed history requires it.
- Verify an abnormal prior screening exits the routine pathway.
- Verify a qualifying one-time AAA screen does not recur after completion.
- Verify a clinician override controls the active next date.
- Verify private adult profile details cannot be accessed by other household members.
- Verify boundary birthdays, leap years, timezones, duplicate imports, stale sources, rule-version changes, and unauthorized document access.

## Completion criteria

- Registration, sign-in, household creation, profile creation, onboarding, plan generation, profile switching, and logout all work.
- Historical and current care events can be created, edited, and deleted safely.
- Approximate dates and method-specific intervals produce correct statuses.
- Source variants can be compared and selected.
- Every recommendation has a working source and explanation.
- Cached source fallback works when an external source is unavailable.
- Family, timeline, calendar, records, medications, reminders, sources, and settings pages are complete.
- CSV import, file attachments, print output, clipboard summary, and calendar export work.
- All privacy boundaries and authenticated file routes are tested.
- Migrations and seeding work against a clean database.
- Lint, formatting, type checks, unit tests, integration tests, end-to-end tests, and production build pass.
- The README contains exact local, Docker, test, seed, backup, restore, and deployment commands.
- Final delivery includes the complete source, migrations, seed rules, tests, documentation, verification commands, and an explicit limitations list.

Ship the result as a source-backed preventive-care organizer whose output remains subject to individual clinical judgment.