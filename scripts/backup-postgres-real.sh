#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

BACKUP_OUT_DIR="${BACKUP_OUT_DIR:-$HOME/Documents/UrucortinasBackups}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-postgres-local}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-react_admin_dashboard}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASE_NAME="${POSTGRES_DB}_${TIMESTAMP}_from_${POSTGRES_CONTAINER_NAME}"
BACKUP_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.sql.gz"
MANIFEST_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.manifest.txt"
SHA_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.sha256"

mkdir -p "$BACKUP_OUT_DIR"

if ! docker ps --format '{{.Names}}' | grep -Fx "$POSTGRES_CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[backup-postgres-real] container not running: $POSTGRES_CONTAINER_NAME" >&2
  exit 1
fi

echo "[backup-postgres-real] dumping $POSTGRES_DB from $POSTGRES_CONTAINER_NAME to $BACKUP_FILE"
docker exec "$POSTGRES_CONTAINER_NAME" sh -lc \
  "pg_dump -U '$POSTGRES_USER' --no-owner --no-privileges '$POSTGRES_DB'" | gzip > "$BACKUP_FILE"

if ! gzip -t "$BACKUP_FILE" >/dev/null 2>&1; then
  echo "[backup-postgres-real] backup archive verification failed: $BACKUP_FILE" >&2
  exit 1
fi

BACKUP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
TABLE_COUNT=$(gunzip -dc "$BACKUP_FILE" | grep -c '^CREATE TABLE ' || true)

cat > "$MANIFEST_FILE" <<EOF
source_container=$POSTGRES_CONTAINER_NAME
database=$POSTGRES_DB
created_at=$TIMESTAMP
archive=$BACKUP_FILE
size_bytes=$BACKUP_SIZE
tables_declared=$TABLE_COUNT
repo_root=$REPO_ROOT
EOF

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BACKUP_FILE" | awk '{print $1 "  " $2}' > "$SHA_FILE"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$SHA_FILE"
fi

ln -sfn "$BACKUP_FILE" "$BACKUP_OUT_DIR/latest.sql.gz"
ln -sfn "$MANIFEST_FILE" "$BACKUP_OUT_DIR/latest.manifest.txt"
ln -sfn "$SHA_FILE" "$BACKUP_OUT_DIR/latest.sha256" 2>/dev/null || true

printf '%s\n' "$BACKUP_FILE"
