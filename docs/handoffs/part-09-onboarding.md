# Part 09 — Progressive onboarding and profile editor

## Scope completed

- Implemented resumable six-screen adult onboarding for profile basics, relevant anatomy, bounded risk context, curated health history, an optional medication, and final review. Medication onboarding includes reason plus a precision-preserving start date.
- Completion creates the household/profile atomically, synchronizes profile context, rebuilds recommendations, clears the draft, and routes to the initial-plan summary and guided-backfill entry point.
- Added an authorized profile editor for demographics, anatomy, tobacco context, height/weight, immunocompromised state, curated conditions, family history, surgery history, and care-plan mode.
- Added relevant pregnancy, alcohol-assessment, fall-concern, and consent-based sexual-health risk inputs with unsure/non-disclosure paths.
- Added pack-year preview and uncertainty, confirmed surgery-to-anatomy updates in the profile transaction, and a count-only post-save care-plan change summary.

## Files added or changed

- `src/components/profile/onboarding-wizard.tsx`
- `src/components/profile/profile-editor.tsx`
- `src/app/api/profiles/onboarding/route.ts`
- `src/app/api/profiles/[profileId]/route.ts`
- `src/server/profiles/**`
- Onboarding, plan-ready, and profile-settings pages

## Public contracts introduced

- `onboardingDraftDataSchema`, `validateOnboardingStep`, `validateCompleteOnboarding`, and `readStoredOnboardingDraftData`
- The onboarding medication contract normalizes exact, month-only, year-only, and unknown start timing before persistence.
- `profileHealthContextFormSchema`, `normalizeProfileHealthContext`, and `synchronizeProfileHealthContext`
- Authorized onboarding draft and profile update HTTP contracts

## Database changes

Part 09 uses the initial migration's `OnboardingDraft`, `Profile`, anatomy, risk, condition, family-history, surgery, medication, audit, and recommendation tables. No separate Part 09 migration was added.

## Tests added

- Adult/future-date, timezone, tobacco-range, optional medication, medication reason/start precision, and complete-onboarding validation
- Draft resume and save-and-continue behavior
- Completion-route persistence for medication reason and normalized start bounds
- Health-context normalization and synchronization
- Authorized profile update and recommendation rebuild behavior
- Pack-year preview, bounded risk payloads, confirmed surgery anatomy updates, and safe plan-change counts

## Commands run

- `pnpm test:coverage`
- `pnpm typecheck`
- `pnpm build`
- Focused Part 09–11 suite: 33 tests passed; focused ESLint passed. The latest workspace typecheck was blocked by a concurrent reminder-schema/client mismatch outside this scope.

The integrated results are recorded in `docs/release-report.md`.

## Known integration considerations

- Medical-context saves rebuild recommendations inside the same transaction.
- Unknown and prefer-not-to-answer values remain explicit; anatomy is not inferred from gender identity.
- The six UI screens combine the PLAN's household/profile and initial-plan/backfill handoffs into adjacent routes.

## Remaining limitations

None of the previously recorded Part 09 acceptance limitations remain.

## No-core-TODO confirmation

No literal TODO/FIXME, unconfirmed surgery anatomy write, or opaque profile-save recalculation remains in this scope.
