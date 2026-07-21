# Part 14 — Medications, clinician overrides, custom maintenance, and personal care plans

## Scope completed

- Implemented profile-scoped medication create/edit/delete with approximate start/end timing, concise notes, explicit normalized class codes, and separate active, paused, ended, review-due, and monitoring-instruction views without inferred care.
- Integrated the real medication create/edit flow with React Hook Form and Zod validation.
- Added replacing and supplemental clinician instructions with exact date, interval, no-longer-needed, and clinician-managed types; instructions can be version-edited, paused/resumed, or ended while baseline guidance stays visible.
- Prevented competing active replacing overrides and rebuilt recommendations transactionally after changes.
- Added personal/clinician custom maintenance, editable template adoption, ask-clinician/disable states, reminders, visibility, and lab bundles with an always-visible non-universal warning.

## Files added or changed

- Medication, clinician-override, and custom-maintenance route handlers and pages
- `src/components/medications/**`
- `src/components/care-plan/clinician-override-*.tsx`
- `src/components/maintenance/**`
- `src/server/custom-maintenance/**`
- Custom-maintenance seed templates

## Public contracts introduced

- `clinicianOverrideInputSchema` and replace/pause/resume/end endpoint contracts
- Custom-maintenance create/update/adopt/disable services and `CUSTOM_LAB_WARNING`
- Medication create/update response contracts and neutral reminder keys
- Controlled approximate-date input support for validated medication timing

## Database changes

- `20260721023000_custom_maintenance` adds custom maintenance, lab entries, source/status/visibility/cadence enums, indexes, and relationships.
- `20260721050000_clinician_override_pause` adds `pausedAt` and active/pause-aware indexes.
- Medication and base clinician-override tables come from the initial migration.
- `20260721060000_normative_surface_gaps` adds medication notes and explicit normalized class-code JSON.

## Tests added

- Medication ownership, React Hook Form/Zod validation, timing/notes/class persistence, explicit class mapping, filters, soft deletion, document cleanup, and no-inference behavior
- Replacing/supplemental conflict handling plus override pause, resume, version edit, end, and rebuild behavior
- Custom-maintenance authorization, scheduling, template adoption, owner-only visibility, and lab warning behavior

## Commands run

- 17-file focused Vitest run: 41 tests passed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec prisma validate`

## Known integration considerations

- Paused overrides remain historical but are excluded from active evaluation, visit prep, and reminder generation.
- Supplemental instructions coexist with baseline guidance; only a single active replacing instruction is allowed per service.
- Custom items are labeled by their personal, clinician, or app-template origin and never as federal recommendations.

## Remaining limitations

- No remaining Part 14 medication-surface limitation is identified.

## No-core-TODO confirmation

No literal TODO/FIXME, medication-name inference, missing medication timing/notes/filter control, competing active replacement, or unlabeled custom lab bundle remains.
