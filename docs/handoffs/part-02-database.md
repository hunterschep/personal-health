# Part 02 — Database schema, migrations, repositories, and synthetic seed framework

## Scope completed

- Added the normalized PostgreSQL/Prisma model for identity, households, profile privacy, health context, services, rules, events, clinician plans, custom maintenance, recommendations, planning, reminders, documents, audits, source caches, imports, onboarding, and history assertions.
- Added six forward-only migrations with range, JSON-shape, file-size, override-shape, and active-guideline-baseline constraints plus the required lookup indexes.
- Added focused repositories, transaction helpers, persistence mappings, deterministic database factories, layered seeds, and four synthetic demo profiles.
- Added atomic workflows for profile/anatomy creation, context mutation with recommendation rebuild, care-event creation, clinician overrides, profile claims, and CSV commits.

## Files added or changed

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `prisma/seed/index.ts` and `prisma/seed/demo.ts`
- `src/server/db/**`
- `src/server/repositories/**`
- `src/test/factories/**`
- `src/test/integration/data-layer.test.ts` and `src/test/integration/demo-seed.test.ts`
- `tests/migration-invariants.test.ts`

## Public contracts introduced

- `createPrismaClient`, `prisma`, `DatabaseClient`, `TransactionClient`, `withTransaction`, and `withSerializableTransaction`
- Focused repository interfaces and factories exported by `src/server/repositories/index.ts`
- Transactional workflows exported by `src/server/db/workflows.ts`
- Deterministic `createDatabaseFactory` fixtures for database tests

## Database changes

- `20260721000000_initial` creates the version-one schema, enums, foreign keys, checks, and indexes.
- Five follow-up migrations add reminder preferences, custom maintenance, document-blob lifecycle state, the conflict-baseline exclusion constraint/current recommendation JSON shapes, and clinician-override pause state.
- User-facing health records generally use soft deletion; immutable sources, rules, and history use restrictive relationships where deletion would break provenance.

## Tests added

- Forward-migration invariants and corrective data-shape migration ordering
- Repository normalization and frozen-contract persistence mappings
- Deterministic synthetic database factories
- Optional PostgreSQL integration coverage for invalid date ranges, transactional rollback, idempotent snapshot synchronization, reminder deduplication, and repeated demo seeding

## Commands run

```text
pnpm exec vitest run tests/migration-invariants.test.ts src/server/repositories/repositories.test.ts src/test/factories/database.test.ts
```

Result: 3 files and 8 tests passed.

## Known integration considerations

- Repository methods do not authorize callers. Services and route handlers must resolve household/profile access first and bind nested IDs to that authorized parent.
- Database-backed suites require `TEST_DATABASE_URL`; demo-seed verification additionally requires `DEMO_SEED_ENABLED=true`.
- Deployments use `prisma migrate deploy`; migrations are forward-only and backups are the rollback mechanism.
- Seed layers are idempotent by stable identifiers and demo credentials come from environment configuration.

## Remaining limitations

- PostgreSQL integration and repeated-seed tests were not exercised by the documentation-only command above because no `TEST_DATABASE_URL` was supplied.
- The schema intentionally does not model a general medical ontology, arbitrary repository filters, or multi-instance job coordination.

## No-core-TODO confirmation

No core Part 02 TODO, placeholder table, generic unaudited repository, or real personal fixture remains. Live PostgreSQL verification remains an environment-dependent release gate.
