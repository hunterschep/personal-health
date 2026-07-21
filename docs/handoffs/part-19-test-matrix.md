# Part 19 — Automated test matrix and quality gates

## Scope completed

Unit, integration, route, accessibility, browser, migration, catalog, rule, source, and operational test layers are wired into deterministic local and CI gates. Medical boundaries include all required named scenarios, a complete active-rule acceptance matrix, approximate-date behavior, methods, variants, overrides, and timezone edges.

## Files added or changed

`src/**/*.test.ts`, `src/**/*.test.tsx`, `tests/**/*.test.ts`, `tests/e2e/**`, `vitest.config.ts`, and `playwright.config.ts`.

## Public contracts introduced

Synthetic factories under `src/test/factories`, PostgreSQL integration helpers, Playwright sign-in/accessibility helpers, and catalog-scenario fixtures are test-only contracts.

## Database changes

None. Integration suites create isolated synthetic databases and apply committed migrations.

## Tests added

Coverage spans date arithmetic, the production evaluator, every active seeded rule's positive, negative, boundary, historical, relevant uncertainty, abnormal-history, method, and relevant variant states, persistence workflows, privacy matrices, imports/exports, documents, reminders, authentication, page states, complete Chromium journeys, mobile Chromium, and a WebKit authentication smoke. CI also runs explicit rule provenance/scenario validation and checked-in-versus-database rule diff gates.

## Commands run

`pnpm test`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e`, targeted WebKit/Firefox smoke runs, and fresh-database integration commands.

## Known integration considerations

Stateful browser journeys run once with one worker against obviously synthetic seed data. Logic and authorization failures are not retried. Live source checks are operator-only; offline structural source verification is the CI gate.

## Remaining limitations

Browser automation and statement coverage reduce regression risk but do not prove clinical validity, accessibility conformance, or absence of security defects.

No core Part 19 TODOs, focused tests, or browser journeys are intentionally disabled.
