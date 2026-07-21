#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

destination=${1:-./backups}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
archive_name="carecadence-backup-${timestamp}.tar.gz"
temporary_directory=$(mktemp -d "${TMPDIR:-/tmp}/carecadence-backup.XXXXXX")
web_stopped=false

cleanup() {
  exit_status=$?
  rm -rf "$temporary_directory"
  if [[ "$web_stopped" == true ]]; then
    docker compose up -d web >/dev/null 2>&1 || \
      echo "WARNING: web did not restart; run: docker compose up -d web" >&2
  fi
  exit "$exit_status"
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

digest_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

require_command docker
require_command node
require_command tar
mkdir -p "$destination"
destination=$(cd "$destination" && pwd)
archive_path="${destination}/${archive_name}"

if [[ -e "$archive_path" ]]; then
  echo "Refusing to overwrite existing backup: $archive_path" >&2
  exit 1
fi

if ! docker compose ps --status running db --quiet | grep -q .; then
  echo "The Compose database service is not running." >&2
  exit 1
fi
if ! docker compose ps --status running web --quiet | grep -q .; then
  echo "The Compose web service is not running; upload files cannot be archived consistently." >&2
  exit 1
fi

echo "Pausing the web service briefly to capture a consistent database and upload set."
docker compose stop web >/dev/null
web_stopped=true

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose exec -T db sh -c \
  'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  >"${temporary_directory}/database.dump"
docker compose run --rm --no-deps -T --entrypoint sh web -c \
  'test -n "$UPLOAD_DIR" && test "$UPLOAD_DIR" != / && exec tar --directory="$UPLOAD_DIR" --create --file=- .' \
  >"${temporary_directory}/uploads.tar"

if [[ ! -s "${temporary_directory}/database.dump" || ! -s "${temporary_directory}/uploads.tar" ]]; then
  echo "Backup validation failed: an expected artifact is empty." >&2
  exit 1
fi

database_sha256=$(digest_file "${temporary_directory}/database.dump")
uploads_sha256=$(digest_file "${temporary_directory}/uploads.tar")
app_version=$(node -p "require('./package.json').version")
completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

node - "${temporary_directory}/manifest.json" <<'NODE' \
  "$app_version" "$started_at" "$completed_at" "$database_sha256" "$uploads_sha256"
const fs = require("node:fs");
const [output, version, startedAt, completedAt, databaseSha256, uploadsSha256] = process.argv.slice(2);
fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      backupFormat: 1,
      appVersion: version,
      startedAt,
      completedAt,
      database: { file: "database.dump", format: "PostgreSQL custom", sha256: databaseSha256 },
      uploads: { file: "uploads.tar", sha256: uploadsSha256 },
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
NODE

tar --directory="$temporary_directory" --create --gzip --file="$archive_path" \
  manifest.json database.dump uploads.tar

if [[ ! -s "$archive_path" ]]; then
  echo "Backup archive was not created." >&2
  exit 1
fi

docker compose up -d --wait web >/dev/null
web_stopped=false

echo "Backup created: $archive_path"
echo "Treat this archive as sensitive health data and encrypt it before off-site storage."
