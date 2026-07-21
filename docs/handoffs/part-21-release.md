# Part 21 — Full-system integration and release handoff

## Scope completed

All product parts are integrated into a coherent CareCadence 1.0 application. Cross-feature routes, privacy transitions, recommendation rebuilds, record and planning journeys, personal clinician plans, reminders, visit preparation, data rights, source transparency, demo data, production packaging, operational recovery, and bounded performance baselines have been reviewed together.

## Files added or changed

Integration fixes span the application where needed; the canonical outcome and exact final evidence are recorded in `docs/release-report.md`, with deployment guidance in `README.md` and `docs/operations.md`.

## Public contracts introduced

No new standalone subsystem contract. Part 21 reconciles the frozen statuses, date precision, service/method identities, source/rule versions, authorization boundaries, reminder states, export shapes, deletion behavior, and audit naming used by earlier parts.

## Database changes

Eight committed forward-only migrations constitute the version-one schema. Clean deployment and upgrade deployment both use `prisma migrate deploy`.

## Tests added

Integration coverage includes demo-seed idempotency, source/rule inventory, complete browser journeys, profile switching, owner-only denial, cross-account documents, upload spoofing and traversal, CSV recovery and row limits, clinician plans, reminders, visit prep, export/deletion, offline behavior, accessibility including recommendation detail, and production-container persistence/restore.

## Commands run

The complete release command matrix and exact counts are recorded in `docs/release-report.md`; it includes install, generate, validate, migrate, seed twice, format, lint, typecheck, coverage, source/rule gates, audits, build, production Playwright without logic retries, WebKit smoke, clean Compose backup/restore verification, and the reproducible performance benchmark in `docs/performance.md`.

## Known integration considerations

The checked-in catalog remains immutable until reviewed source changes are authored as new rule versions. Operators must preserve private database/upload backups and treat exported archives as separate sensitive copies.

## Keyboard and reflow acceptance checklist

- [x] The public skip link moves focus to the main content.
- [x] Desktop primary navigation has visible, ordered keyboard focus and a keyboard-operable collapse control.
- [x] Mobile overflow navigation traps focus, closes with Escape, and returns focus to its trigger.
- [x] Calendar month choices and planning controls have a non-drag keyboard path.
- [x] Form controls expose labels, validation text, and error associations.
- [x] Dialogs and disclosure controls have named triggers and keyboard dismissal.
- [x] Print output preserves headings and readable, non-interactive content.
- [x] The 320-pixel layout provides the narrow reflow boundary used for 200% desktop-zoom acceptance.
- [x] Reduced-motion and dark-mode preferences retain content and focus behavior.

Automated keyboard, axe, and reflow checks support this list. They do not replace a deployment-specific screen-reader or formal WCAG review.

## Remaining limitations

Version one is U.S.-adult preventive-care organization software, not diagnosis or medical advice. The truthful product, deployment, medical-coverage, security, and compliance limitations are listed in the release report.

No core Part 21 TODOs, dead buttons, placeholder pages, or intentionally skipped release gates remain.
