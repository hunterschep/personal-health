# Operations guide

This guide covers a self-hosted CareCadence deployment using Docker Compose. Run commands from the repository root.

## Environment reference

Copy `.env.example` to `.env`. Docker Compose reads `.env` for interpolation; it does not bake these values into the image.

| Variable                           | Need                               | Safe local value                                                  | Production guidance and change effect                                                                                                                                    |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                     | Required for host-side commands    | `postgresql://carecadence:carecadence@localhost:5432/carecadence` | Use a restricted PostgreSQL role and TLS when the database is remote. Changing it selects different data. Compose constructs its internal URL from `POSTGRES_*`.         |
| `AUTH_SECRET`                      | Required                           | Generate with `openssl rand -base64 48`                           | Unique and secret. Changing it invalidates authentication state and should be treated as a session reset.                                                                |
| `AUTH_TRUST_HOST`                  | Required                           | `true`                                                            | Enable only behind a proxy that supplies a trusted host. Does not change stored data.                                                                                    |
| `SESSION_COOKIE_SECURE`            | Optional local HTTP override       | `false`                                                           | Set `true` whenever the public origin uses HTTPS. Outside Compose it defaults to `true` in production; changing it affects newly written browser cookies.                |
| `APP_BASE_URL`                     | Required for generated links       | `http://localhost:3000`                                           | Use the canonical HTTPS origin. Changing it affects new links and calendar exports, not stored health data.                                                              |
| `UPLOAD_DIR`                       | Required                           | `./uploads`                                                       | Use durable private storage with restrictive permissions. Compose fixes this to `/app/uploads`. Moving it requires moving existing files.                                |
| `MAX_UPLOAD_BYTES`                 | Optional                           | `10485760`                                                        | Keep within proxy/body limits. Lowering it affects new uploads only.                                                                                                     |
| `SOURCE_SYNC_ENABLED`              | Optional                           | `false`                                                           | Leave off unless scheduled anonymous enrichment is desired. Does not change rule logic.                                                                                  |
| `SOURCE_STALE_DAYS`                | Optional                           | `180`                                                             | Review policy for cached source content. Changing it changes freshness labels only.                                                                                      |
| `DEMO_SEED_ENABLED`                | Optional                           | `true` locally                                                    | Set `false` in production. Changing it affects future seed runs; it does not remove existing demo records.                                                               |
| `DEMO_USER_EMAIL`                  | Required when demo seed is enabled | `demo@carecadence.local`                                          | Use synthetic-only credentials. Later seed runs update the two reserved demo identities; the seed stops if the requested address belongs to a non-demo account.          |
| `DEMO_USER_PASSWORD`               | Required when demo seed is enabled | `carecadence-demo-only`                                           | Replace outside an isolated local machine. Seed runs can update demo credentials.                                                                                        |
| `DEFAULT_TIMEZONE`                 | Optional                           | `America/New_York`                                                | IANA timezone for new/default scheduling. Existing explicit dates remain unchanged.                                                                                      |
| `SMTP_HOST`                        | Optional as a complete SMTP set    | blank                                                             | Set with all other SMTP fields to enable verification, reset, and reminder email. Changing it affects future delivery only.                                              |
| `SMTP_PORT`                        | Optional as a complete SMTP set    | blank                                                             | Usually `587` with STARTTLS or `465` with `SMTP_SECURE=true`.                                                                                                            |
| `SMTP_SECURE`                      | Optional                           | `false`                                                           | Controls implicit TLS for future SMTP connections.                                                                                                                       |
| `SMTP_USERNAME`                    | Optional as a complete SMTP set    | blank                                                             | Treat as a secret; future delivery only.                                                                                                                                 |
| `SMTP_PASSWORD`                    | Optional as a complete SMTP set    | blank                                                             | Treat as a secret; future delivery only.                                                                                                                                 |
| `SMTP_FROM`                        | Optional as a complete SMTP set    | blank                                                             | Use a verified neutral sender. Changing it affects future messages.                                                                                                      |
| `REMINDER_OVERDUE_SNOOZE_MAX_DAYS` | Optional                           | `31`                                                              | Maximum overdue-reminder snooze duration. Changing it affects new snooze requests, not stored recommendation timing.                                                     |
| `REMINDER_DISPATCH_SECRET`         | Optional HTTP cron secret          | blank                                                             | Leave blank when using CLI cron. Set to a unique 32+ character value only for the protected HTTP dispatch route; rotating it invalidates scheduler requests immediately. |
| `AUTH_RATE_LIMIT_ATTEMPTS`         | Optional                           | `8`                                                               | Lower for stricter sign-in protection. In-memory counters reset with the process.                                                                                        |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES`   | Optional                           | `15`                                                              | Applies to new failed sign-in windows only.                                                                                                                              |
| `SESSION_DURATION_DAYS`            | Optional                           | `30`                                                              | Maximum `90`. Changing it affects newly issued sessions; revoke existing sessions separately.                                                                            |
| `LOG_LEVEL`                        | Optional                           | `info`                                                            | Avoid verbose production logging. Never log health payloads.                                                                                                             |
| `POSTGRES_USER`                    | Compose only                       | `carecadence`                                                     | Changing after volume initialization requires a database migration/role change.                                                                                          |
| `POSTGRES_PASSWORD`                | Compose only                       | `carecadence`                                                     | Use a long random value. Rotate in PostgreSQL and `.env` together.                                                                                                       |
| `POSTGRES_DB`                      | Compose only                       | `carecadence`                                                     | Changing it selects/initializes another database.                                                                                                                        |
| `POSTGRES_PORT`                    | Compose only                       | `5432`                                                            | Bound to `127.0.0.1`, not the LAN. A change only affects host-side access.                                                                                               |
| `APP_PORT`                         | Compose only                       | `3000`                                                            | Host HTTP port; also update `APP_BASE_URL`.                                                                                                                              |
| `BUILD_VERSION`                    | Optional                           | `development`                                                     | Non-secret release label shown by health checks. Backup compatibility uses the semantic version in `package.json`.                                                       |

`NODE_ENV` is managed by Next.js and the container. Do not set it to a nonstandard value. Empty SMTP fields are valid; a partially configured SMTP set is rejected. Enabling SMTP makes email ownership confirmation mandatory before email-bound invitation acceptance and enables self-service password reset.

## Start and update

For the full container stack:

```bash
cp .env.example .env
# Replace AUTH_SECRET and production credentials in .env.
docker compose up --build --wait
```

The `init` service waits for PostgreSQL, applies committed migrations, and idempotently seeds the source/rule catalog. Synthetic demo data is added only when `DEMO_SEED_ENABLED=true`. Both `init` and `web` use UID/GID `1001` and mount the same private-upload volume so the synthetic demo document remains private and readable after initialization. The web service starts only after initialization succeeds.

To update:

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d --wait
```

Read migration notes before upgrading across a major application version. Back up first. Do not run `prisma migrate dev` in production.

## Health and logs

- `GET /api/health?mode=liveness` checks only that the application process can respond.
- `GET /api/health?mode=readiness` probes PostgreSQL and a temporary private-storage file. It returns HTTP `503` if either dependency fails.
- Responses expose only status labels, build version, and time. They never expose profile counts, connection strings, filesystem paths, or source details.

Useful commands:

```bash
docker compose ps
docker compose logs --tail=200 web init db
curl --fail http://localhost:3000/api/health?mode=readiness
```

The container health check uses readiness. If the database is intentionally down for maintenance, the web container will be unhealthy until it returns.

## Backup

```bash
./scripts/backup.sh ./backups
```

The script verifies the Compose database and web services, briefly stops web writes, creates a PostgreSQL custom-format dump, archives the private upload volume, writes a versioned manifest with SHA-256 checksums, restarts the web service, and emits one timestamped `.tar.gz`. It fails rather than overwrite an existing archive and verifies that artifacts are non-empty.

Backups do not include `.env`, but they do include health and identity data. Encrypt before off-site storage, for example with an organization-approved `age`, GPG, or encrypted backup system. Keep encryption keys separately. Define retention and test a restore in an isolated environment regularly.

## Restore

First create a current backup and move it outside `./backups`. Confirm the target repository and `.env`, then run:

```bash
./scripts/restore.sh /secure/path/carecadence-backup-YYYYMMDDTHHMMSSZ.tar.gz
```

The restore checks archive paths, required artifacts, manifest version, application major-version compatibility, and checksums before showing a destructive confirmation. It stops web, replaces database objects and upload contents, applies compatible pending migrations, restarts web, and requires readiness to pass. For an automated disposable restore test only, `--yes` skips the typed confirmation.

Restore with the same application major version that created the backup. If readiness fails, do not accept traffic; inspect `docker compose logs web db`, restore the pre-restore backup if needed, and resolve the error before retrying.

## Scheduling

Reminder dispatch is safe to invoke more than once for the same window:

```cron
17 7 * * * cd /srv/carecadence && docker compose run --rm --no-deps init pnpm reminders:dispatch >>/var/log/carecadence-reminders.log 2>&1
```

Keep cron output free of health details and apply restrictive log permissions. Without a complete SMTP configuration, reminders remain in-app.

The web process verifies configured SMTP in the background with a bounded timeout. A failed check
does not block startup or in-app reminders; reminder settings show the neutral unavailable state so
an administrator can correct the SMTP configuration. Dispatch verifies the connection again before
claiming any rows and leaves reminders pending if verification fails.

Run dispatch at least daily when digest delivery is enabled. An individual preference sends each
due item. A daily digest groups due items and sends at most once per profile-local date. A weekly
digest accumulates pending items and sends on Monday in the preference timezone. The persisted
last-digest timestamp and advisory lock make repeated scheduler calls in the same window safe.

CLI cron is preferred because it does not expose a remote operation. If the deployment platform only supports HTTP scheduling, generate a separate secret with `openssl rand -base64 48`, set `REMINDER_DISPATCH_SECRET`, and call:

```bash
curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer $REMINDER_DISPATCH_SECRET" \
  https://care.example.com/api/internal/reminders/dispatch
```

The route is unavailable when the secret is blank or shorter than 32 characters. Keep this secret out of URLs and logs. The response contains counts only; reminder text and health details are never returned. Repeated calls are safe because delivery uses stable dedupe keys and database locking.

### Private document cleanup

Document deletion first makes the database record unavailable, then immediately attempts to remove
the private blob. If storage is temporarily unavailable, the record remains soft-deleted with its
blob cleanup pending. Run the retry worker at least hourly on the same host and private-upload volume
as the web service:

```cron
23 * * * * cd /srv/carecadence && docker compose run --rm --no-deps init pnpm storage:cleanup >>/var/log/carecadence-storage-cleanup.log 2>&1
```

For a non-Compose installation, schedule the equivalent command from the application directory:

```bash
pnpm storage:cleanup
```

The command selects only soft-deleted documents whose `blobDeletedAt` marker is still empty. It
prints JSON counts for pending, deleted, and failed items and exits nonzero if any deletion failed.
Alert on a nonzero exit and rerun after restoring storage access; retries are safe. An already-missing
blob is treated as successfully deleted, so a retry also repairs the marker when the blob was removed
but the earlier database update did not complete.

While cleanup is pending, the document cannot be downloaded or exported, but its bytes may still be
present in private storage and backups. Fix the volume mount, permissions, or available disk space,
then rerun `pnpm storage:cleanup` until `failed` is zero. Do not manually set `blobDeletedAt` or remove
the database row: the marker is evidence that physical deletion completed. Cleanup logs and audit
events contain identifiers and counts, not filenames, storage keys, or document contents; protect
them with the same restrictive permissions as other application logs.

Suggested source maintenance is monthly and after major guideline announcements:

```bash
pnpm sources:verify
pnpm sources:verify --live
pnpm sources:report
pnpm sources:review --source <slug> --cache-key <opaque-key> --decision <approved|rejected|acknowledged> --reviewer <name>
pnpm rules:validate
pnpm rules:diff --from <old-version> --to <new-version>
pnpm recommendations:rebuild --rule <stable-key> --dry-run --as-of YYYY-MM-DD
pnpm test
```

Normal CI runs structural verification only and makes no live medical-source request. A live check is an operator signal, not automatic medical approval. Review changed content and provenance, update a versioned rule only after human review, rebuild snapshots, test, and deploy.

### Release performance baseline

After `pnpm build` and a clean synthetic seed, run the read-only release benchmark with a disposable database:

```bash
DATABASE_URL=postgresql://carecadence:carecadence@127.0.0.1:5432/carecadence_benchmark \
  DEMO_USER_EMAIL=demo@carecadence.local \
  BENCHMARK_ITERATIONS=7 \
  pnpm exec tsx scripts/benchmark-release.ts
```

It reports standalone/static bundle bytes, overview and family SQL statement counts and read-model timing, one-profile dry-run rebuild timing, and parse/preview timing at the 1,000-row CSV limit. It writes no health state. Record the host and database topology when comparing results; the release baseline and interpretation are in [performance.md](performance.md).

## Reverse proxy and security

Expose only the web port through a TLS-terminating reverse proxy and set `SESSION_COOKIE_SECURE=true`. The Compose default is `false` only so the loopback HTTP quickstart can sign in. Keep PostgreSQL private; its Compose host mapping is loopback-only for local tooling and can be removed on a remote Docker host. Strip untrusted forwarding headers, then set the original host, scheme, and canonical client address at the proxy. Sign-in throttling uses the first trusted `X-Forwarded-For` address and is process-local, so multiple web replicas require a shared edge or centralized rate limiter. Cap request bodies consistently with `MAX_UPLOAD_BYTES` and use conservative timeouts.

Production responses include HSTS, which browsers honor only over HTTPS. Do not place the service on the public internet before TLS, strong secrets, host updates, backup encryption, and access review are complete. See [privacy-model.md](privacy-model.md).

## Failure recovery

- **Database unavailable:** readiness returns `503`; check `db` health, disk space, and credentials. Do not reset the volume.
- **Storage unavailable:** confirm the `private-uploads` volume is mounted and writable by UID/GID `1001`; do not switch to ephemeral storage.
- **Initialization failed:** inspect `docker compose logs init`; correct the migration or seed issue and rerun `docker compose up init`.
- **SMTP unavailable:** in-app operation continues. Existing users can still sign in; verification/reset mail and reminder delivery wait until SMTP returns. Fix SMTP and rerun idempotent reminder dispatch later.
- **Account password lost:** with SMTP configured, use the neutral self-service reset page. Otherwise, from a trusted application host run `pnpm account:recover -- --email user@example.com`. The local command securely prompts for a replacement and revokes all sessions. For automation, use an owner-only password file or standard input, never a command-line password.
- **External source unavailable:** deterministic recommendations continue; cached consumer content is labeled with its freshness.
- **Disk full:** stop writes, make space without deleting the database/volume, then verify readiness and create a backup.
