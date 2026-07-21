# Part 12 — Annual roadmap, longitudinal timeline, planning calendar, and milestones

## Scope completed

- Implemented month, agenda, and year roadmap views that distinguish due windows, flexible timing, personal cadences, reminders, planned months, and exact appointments by label and shape.
- Spanning medical due ranges appear once in their earliest month with the full range label and never inherit an invented day; exact dates remain day-positioned.
- The year roadmap keeps flexible annual timing, dates needing confirmation, and unscheduled future guidance in separate labeled buckets.
- Added authorized planned-action create/update/cancel flows with timezone-aware appointment validation, optional reminder offsets, and no mutation of recommendation due dates.
- Added a profile-scoped longitudinal timeline for records, snapshot states, plans, appointments, clinician instructions, variant selections, rule updates, documents, history assertions, and future milestones.
- Added neutral RFC-style `.ics` generation for individual actions, the full profile calendar, and an explicitly selected roadmap subset with stable UIDs, sequences, folding, timezone labels, and non-sensitive descriptions.
- Added reversible reminder snooze metadata with a configurable overdue maximum. Cancelling a snooze restores its original reminder timing without changing recommendation status or due dates.

## Files added or changed

- `src/components/planning/annual-roadmap.tsx`
- Calendar and timeline pages
- `src/app/api/profiles/[profileId]/planned-actions/**`
- Calendar `.ics` route handlers
- `src/server/calendar/**`
- `src/server/read-models/timeline.ts`

## Public contracts introduced

- `CalendarEvent`, `createIcs`, `plannedMonthRange`, and planned-action calendar mapping
- Planned-action create/update contracts with local wall-time conversion
- `TimelineEntry`, `TimelineFilters`, `loadProfileTimeline`, and `filterTimelineEntries`

## Database changes

Part 12 uses the initial migration's planning models. `20260721060000_normative_surface_gaps` adds `Reminder.snoozedFrom` and `Reminder.snoozedUntil` plus the profile snooze index.

## Tests added

- Local-time/DST conversion and RFC line folding
- Appointment validation, reminder rescheduling, profile authorization, and neutral calendar content
- Month/agenda/year keyboard behavior, planning-date separation, and keyboard-accessible selected-item export
- Earliest-month range placement, exact-day versus range behavior, and distinct annual roadmap buckets
- Timeline precision, filtering, custom maintenance, age boundaries, and milestone behavior
- Configurable overdue-snooze bounds, original-timing restoration, and unchanged recommendation status/due timing

## Commands run

- 17-file focused Vitest run: 41 tests passed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec prisma validate`

## Known integration considerations

- Selecting a planned month is the keyboard/mobile alternative to drag-and-drop and never rewrites due timing.
- Exact appointment instants are stored with the selected IANA timezone; date-only roadmap values remain calendar dates.
- Reminder snooze state is owned by Part 16 rather than by recommendation snapshots.

## Remaining limitations

- No remaining core Part 12 acceptance limitation is identified. The quick snooze action remains seven days and is bounded by the configurable overdue maximum.

## No-core-TODO confirmation

No literal TODO/FIXME, repeated spanning range, conflated unscheduled bucket, due-date mutation through planning or snooze, sensitive calendar description, missing roadmap-selection export, or non-restorable snooze remains.
