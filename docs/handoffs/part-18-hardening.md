# Part 18 — Security, privacy, accessibility, resilience, and performance

## Scope completed

Central profile authorization, neutral not-found responses, same-origin mutation checks, bounded authentication attempts, private-file validation and delivery, value-free audit records, strict response headers, static-only offline behavior, error boundaries, responsive layouts, keyboard states, reduced motion, dark mode, automated accessibility scans, and reproducible production performance measurements are implemented.

## Files added or changed

`src/server/authorization/**`, `src/server/auth/**`, `src/server/storage/**`, `src/app/api/**`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/components/**`, `src/proxy.ts`, `scripts/benchmark-release.ts`, `docs/privacy-model.md`, and `docs/performance.md`.

## Public contracts introduced

`requireProfileAccess`, `profileCapabilities`, `canAccessProfileResource`, same-origin helpers, rate-limit helpers, upload validation, private storage, and neutral HTTP error mapping.

## Database changes

Authorization grants, revocable sessions, verification tokens, soft-deletion fields, document blob lifecycle fields, and minimal audit records are persisted by the committed migrations.

## Tests added

The suite covers the full actor/resource authorization matrix, cross-profile entity binding, private downloads, MIME spoofing, traversal, upload limits, CSV formula escaping and row limits, session revocation, authentication throttling, error states, axe scans including recommendation detail, mobile containment, dark mode, reduced motion, and offline boundaries.

## Commands run

`pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm audit --prod`, Playwright desktop/mobile/accessibility runs, and the clean-database `scripts/benchmark-release.ts` procedure recorded in `docs/performance.md`.

## Known integration considerations

TLS, trusted-proxy handling, encrypted backups, host patching, log review, and malware controls remain deployment responsibilities. Process-local rate limiting is appropriate only for the included single-instance topology.

The measured overview/family SQL baselines include server read-model work but exclude the session-cookie lookup and browser/proxy transfer. They are regression signals, not production service-level guarantees.

## Remaining limitations

Automated checks are not a penetration test, formal WCAG audit, or compliance assessment. Uploaded documents are content-checked but not virus-scanned.

No core Part 18 TODOs, placeholder controls, or known authorization bypasses remain.
