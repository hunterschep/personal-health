# Part 16 — Reminder center, planning prompts, and optional email dispatch

## Scope completed

- Implemented profile-scoped in-app reminder generation for eligible recommendations, planned months/appointments, clinician reviews, medication reviews, custom maintenance, and unknown-history prompts.
- Added stable dedupe keys, quiet-time adjustment, monthly overdue resurfacing, neutral class-aware copy, a dedicated Snoozed section, reversible seven-day snooze, dismiss/restore, and view-only behavior.
- Added optional owner-controlled SMTP email, neutral subjects/content, signed authentication-gated links, advisory-lock dispatch, bounded retries, dry run, fixed clock, batching, and value-free logs. Startup verification is bounded and non-blocking; failure is surfaced in reminder settings while in-app operation continues.
- Added per-user/profile channel, quiet-day/hour, planning-window, history-prompt, activity-detail, timezone, and digest preferences. Daily digests send at most once per profile-local day; weekly digests accumulate for Monday in the profile timezone.

## Files added or changed

- Reminder center and settings components/pages
- Reminder generation, mutation, preference, and signed-link routes
- `src/server/reminders/**`
- `scripts/dispatch-reminders.ts`
- Optional internal dispatch endpoint

## Public contracts introduced

- `ReminderCandidate` plus recommendation, planned-action, medication, clinician-plan, and maintenance candidate builders
- `ReminderMailer`, SMTP settings, signed reminder-link, reminder-copy, and dispatch result contracts
- SMTP startup delivery status and timezone-aware digest-window behavior
- Profile reminder-preference read/write contracts

## Database changes

`20260721010000_reminder_preferences` adds `ReminderPreference`, digest mode, quiet scheduling, profile/user relationships, and indexes. `20260721060000_normative_surface_gaps` adds snooze origin/until fields and the persisted last-digest timestamp.

## Tests added

- Candidate eligibility, neutral shared-decision copy, monthly dedupe, appointment timezone, quiet scheduling, and profile preferences
- Snooze/cancel/dismiss/restore authorization, configured overdue bounds, dedicated Snoozed UI, and recommendation-detail visibility
- SMTP validation, bounded non-blocking startup verification, safe failure status, neutral email, signed links, retry, advisory-lock concurrency, idempotency, and no-SMTP behavior
- Actual multi-item digest grouping, daily one-per-local-day behavior, and deterministic Monday weekly delivery

## Commands run

- 17-file focused Vitest run: 41 tests passed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec prisma validate`

## Known integration considerations

- In-app reminders require no external service; email remains disabled unless the complete SMTP configuration exists and the profile owner opts in.
- Dispatch scheduling is an operator responsibility and should run the idempotent CLI or protected internal endpoint.
- Snooze/dismiss affect reminder rows only, never recommendation status or due dates.
- The documented daily dispatcher supports both digest modes: daily sends once per local date and weekly sends accumulated pending reminders on Monday in the preference timezone.

## Remaining limitations

- Weekly digest delivery uses deterministic Monday scheduling; there is no custom weekday preference.

## No-core-TODO confirmation

No literal TODO/FIXME, missing Snoozed view, non-restorable snooze, persisted-only digest setting, startup-blocking SMTP failure, duplicate-send race in the supported PostgreSQL dispatcher, or sensitive email subject remains.
