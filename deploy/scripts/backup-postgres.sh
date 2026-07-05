#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/codeworks_${timestamp}.dump"

mkdir -p "${backup_dir}"
pg_dump \
  --format=custom \
  --host=postgres \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --file="${target}"

echo "backup_created=${target}"
