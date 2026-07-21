# Part 00 — Architecture contracts and repository skeleton

## Scope completed

- Established the Next.js 16, React 19, TypeScript 6, pnpm, Tailwind, Prisma, Vitest, Testing Library, Playwright, ESLint, and Prettier foundation.
- Added strict, Zod-backed contracts for profiles, care events, rules, recommendations, imports, exports, authentication, date ranges, and clinician overrides.
- Added route metadata, environment and capability parsing, typed application errors, action and pagination results, correlation IDs, deterministic clocks, root loading/error/not-found boundaries, and the architecture document.
- Kept domain contracts importable without database or network access.

## Files added or changed

- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, and root tool configuration
- `src/config/**`
- `src/contracts/**`
- `src/domain/shared/**`
- `src/server/http/request-id.ts`
- `src/app/layout.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, and `src/app/not-found.tsx`
- `docs/architecture.md`

## Public contracts introduced

- Zod schemas and inferred types exported by `src/contracts/index.ts`
- `ActionResult<T>`, `PaginatedResult<T>`, `AuthorizationResult<T>`, `success`, and `failure`
- `Clock`, `SystemClock`, and `TestClock`
- `AppError` and the validation, authentication, authorization, not-found, conflict, and external-source error classes
- `routes`, `ServerEnv`, `parseServerEnv`, `Capabilities`, and `capabilitiesFromEnvironment`
- Request correlation ID helpers that do not include profile data

## Database changes

None. Part 00 configured Prisma and the generation/migration commands; Part 02 owns the schema and first migration.

## Tests added

- Environment acceptance and rejection cases
- Authentication configuration and cookie policy
- Unique route constants
- Shared contract validation and typed result helpers
- Deterministic clock behavior across timezones
- Correlation ID generation and propagation

## Commands run

```text
pnpm exec vitest run src/config src/contracts src/domain/shared src/server/http/request-id.test.ts
```

Result: 7 files and 14 tests passed.

## Known integration considerations

- Server entry points must call `getServerEnv`; pure contract and domain modules should not read process environment or initialize Prisma.
- Dates without times remain ISO date strings at contract and domain boundaries. Callers convert instants to the profile timezone before evaluation.
- Feature code should reuse the frozen statuses, rule schemas, route constants, and error/result shapes rather than adding parallel literals.
- Part 02's first deployment command is `pnpm db:migrate:deploy`; local schema development uses `pnpm db:migrate`.

## Remaining limitations

- A production build needs valid environment values and a generated Prisma client even when a database connection is not exercised during rendering.
- Component completeness belongs to Part 01; Part 00 only established the application and contract skeleton.

## No-core-TODO confirmation

No core Part 00 TODO, placeholder contract, fake route, or debug logging remains in the owned paths.
