#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

assume_yes=false
if [[ ${1:-} == "--yes" ]]; then
  assume_yes=true
  shift
fi

archive_path=${1:-}
if [[ -z "$archive_path" ]]; then
  echo "Usage: $0 [--yes] /path/to/carecadence-backup.tar.gz" >&2
  exit 2
fi
if [[ ! -r "$archive_path" || ! -s "$archive_path" ]]; then
  echo "Backup archive is missing, unreadable, or empty: $archive_path" >&2
  exit 1
fi

for command_name in docker node tar curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
done

temporary_directory=$(mktemp -d "${TMPDIR:-/tmp}/carecadence-restore.XXXXXX")
trap 'rm -rf "$temporary_directory"' EXIT

manifest_count=0
database_count=0
uploads_count=0
while IFS= read -r entry; do
  case "$entry" in
    manifest.json) manifest_count=$((manifest_count + 1)) ;;
    database.dump) database_count=$((database_count + 1)) ;;
    uploads.tar) uploads_count=$((uploads_count + 1)) ;;
    *)
      echo "Unexpected path in backup archive: $entry" >&2
      exit 1
      ;;
  esac
done < <(tar --list --gzip --file="$archive_path")
if [[ $manifest_count -ne 1 || $database_count -ne 1 || $uploads_count -ne 1 ]]; then
  echo "Backup must contain exactly one manifest, database dump, and upload archive." >&2
  exit 1
fi
while IFS= read -r verbose_entry; do
  if [[ ${verbose_entry:0:1} != "-" ]]; then
    echo "Backup archive contains a non-regular artifact." >&2
    exit 1
  fi
done < <(tar --list --verbose --gzip --file="$archive_path")

tar --extract --gzip --no-same-owner --file="$archive_path" --directory="$temporary_directory"
for expected_file in manifest.json database.dump uploads.tar; do
  if [[ ! -s "${temporary_directory}/${expected_file}" ]]; then
    echo "Backup is incomplete: ${expected_file} is missing or empty." >&2
    exit 1
  fi
done

read -r backup_format backup_version database_sha256 uploads_sha256 < <(
  node -e '
    const m = require(process.argv[1]);
    process.stdout.write(`${[m.backupFormat, m.appVersion, m.database?.sha256, m.uploads?.sha256].join(" ")}\n`);
  ' "${temporary_directory}/manifest.json"
)
if [[ "$backup_format" != "1" ]]; then
  echo "Unsupported backup format: $backup_format" >&2
  exit 1
fi

current_version=$(node -p "require('./package.json').version")
if [[ "${backup_version%%.*}" != "${current_version%%.*}" ]]; then
  echo "Backup app version $backup_version is not compatible with app version $current_version." >&2
  exit 1
fi

digest_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

if [[ "$(digest_file "${temporary_directory}/database.dump")" != "$database_sha256" ]] \
  || [[ "$(digest_file "${temporary_directory}/uploads.tar")" != "$uploads_sha256" ]]; then
  echo "Backup checksum validation failed." >&2
  exit 1
fi

while IFS= read -r upload_entry; do
  case "$upload_entry" in
    /* | ../* | */../* | *'/..')
      echo "Unsafe path in upload archive: $upload_entry" >&2
      exit 1
      ;;
  esac
done < <(tar --list --file="${temporary_directory}/uploads.tar")
while IFS= read -r verbose_entry; do
  case "${verbose_entry:0:1}" in
    - | d) ;;
    *)
      echo "Upload archive contains an unsupported link or special file." >&2
      exit 1
      ;;
  esac
done < <(tar --list --verbose --file="${temporary_directory}/uploads.tar")

compose_config=$(docker compose config --format json)
target_project=$(node -e '
  const config = JSON.parse(process.argv[1]);
  process.stdout.write(process.env.COMPOSE_PROJECT_NAME || config.name || "carecadence");
' "$compose_config")
configured_base_url=$(node -e '
  const config = JSON.parse(process.argv[1]);
  process.stdout.write(config.services?.web?.environment?.APP_BASE_URL || "");
' "$compose_config")

echo "WARNING: this replaces the current CareCadence database and every private upload."
echo "Target Compose project: $target_project"
echo "Create and move a current backup to safe storage before continuing."

if [[ "$assume_yes" != true ]]; then
  read -r -p "Type RESTORE $target_project to continue: " confirmation
  if [[ "$confirmation" != "RESTORE $target_project" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

docker compose up -d db
for _attempt in {1..30}; do
  if docker compose exec -T db sh -c \
    'pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker compose exec -T db sh -c \
  'pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >/dev/null 2>&1; then
  echo "Database did not become ready." >&2
  exit 1
fi

docker compose stop web >/dev/null 2>&1 || true
docker compose exec -T db sh -c \
  'set -eu
   dropdb --username="$POSTGRES_USER" --maintenance-db=postgres --force --if-exists "$POSTGRES_DB"
   createdb --username="$POSTGRES_USER" --maintenance-db=postgres "$POSTGRES_DB"
   exec pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --no-privileges --exit-on-error --single-transaction' \
  <"${temporary_directory}/database.dump"

docker compose run --rm --no-deps -T --entrypoint sh web -c '
  set -eu
  test "$UPLOAD_DIR" = /app/uploads
  find "$UPLOAD_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  tar --directory="$UPLOAD_DIR" --extract --file=-
' <"${temporary_directory}/uploads.tar"

docker compose run --rm --no-deps init pnpm db:migrate:deploy
docker compose up -d web

base_url="${APP_BASE_URL:-${configured_base_url:-http://localhost:${APP_PORT:-3000}}}"
health_url="${base_url%/}/api/health?mode=readiness"
for _attempt in {1..60}; do
  if curl --fail --silent --show-error "$health_url" >/dev/null 2>&1; then
    echo "Restore complete. Readiness passed at $health_url"
    exit 0
  fi
  sleep 1
done

echo "Restore finished, but readiness did not pass at $health_url." >&2
echo "Inspect with: docker compose logs web db" >&2
exit 1
