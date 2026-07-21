# Part 20 — Docker, CI, backup, restore, and deployment

## Scope completed

A multi-stage non-root image, PostgreSQL-backed Compose topology, one-shot migration/seed initializer, health checks, durable private storage, checksummed backup/restore, maintenance commands, CI quality gates, production dependency audit, Chromium coverage, WebKit smoke coverage, explicit active-rule validation, and checked-in/database rule-diff enforcement are implemented.

## Files added or changed

`Dockerfile`, `compose.yaml`, `.dockerignore`, `.env.example`, `.github/workflows/ci.yml`, `scripts/*.sh`, `scripts/*.ts`, `docs/operations.md`, and `README.md`.

## Public contracts introduced

Readiness/liveness endpoints, environment-variable schema, Compose service/volume names, backup manifest format, and operator command interfaces documented in `docs/operations.md`.

## Database changes

Deployments apply all committed Prisma migrations before the web process starts. Seed execution is idempotent and demo data is explicitly gated.

## Tests added

Operational tests cover environment parsing, health responses, backup/restore validation, account recovery, document cleanup, reminder dispatch, source/rule commands, and Docker persistence behavior.

## Commands run

`docker compose build`, clean `docker compose up --wait`, repeated initializer/seed runs, service restarts, `scripts/backup.sh`, `scripts/restore.sh`, health probes, and all CI-equivalent package commands.

## Known integration considerations

Production needs a maintained TLS reverse proxy, unique secrets, durable volumes, encrypted off-site backups, an external reminder schedule, and SMTP only when email features are desired.

## Remaining limitations

The bundled topology is a single application instance. Multi-replica coordination, shared throttling, object storage, and managed backup retention are outside version one.

No core Part 20 TODOs or unrecoverable local-only deployment assumptions remain.
