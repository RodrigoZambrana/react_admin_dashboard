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
BACKUP_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.dump"
MANIFEST_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.manifest.txt"
SHA_FILE="$BACKUP_OUT_DIR/${BASE_NAME}.sha256"

mkdir -p "$BACKUP_OUT_DIR"

if ! docker ps --format '{{.Names}}' | grep -Fx "$POSTGRES_CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[backup-postgres-real] container not running: $POSTGRES_CONTAINER_NAME" >&2
  exit 1
fi

echo "[backup-postgres-real] dumping $POSTGRES_DB from $POSTGRES_CONTAINER_NAME to $BACKUP_FILE"
docker exec "$POSTGRES_CONTAINER_NAME" sh -lc \
  "pg_dump -Fc -U '$POSTGRES_USER' --no-owner --no-privileges '$POSTGRES_DB'" > "$BACKUP_FILE"

BACKUP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
if command -v pg_restore >/dev/null 2>&1; then
  if ! pg_restore -l "$BACKUP_FILE" >/dev/null 2>&1; then
    echo "[backup-postgres-real] backup archive verification failed: $BACKUP_FILE" >&2
    exit 1
  fi
  TOC_ENTRY_COUNT=$(pg_restore -l "$BACKUP_FILE" | grep -vc '^;' || true)
  TABLE_DATA_COUNT=$(pg_restore -l "$BACKUP_FILE" | grep -c 'TABLE DATA' || true)
else
  if ! docker run --rm -v "$BACKUP_OUT_DIR":"$BACKUP_OUT_DIR" postgres:16-alpine \
    pg_restore -l "$BACKUP_FILE" >/dev/null 2>&1; then
    echo "[backup-postgres-real] backup archive verification failed: $BACKUP_FILE" >&2
    exit 1
  fi
  TOC_ENTRY_COUNT=$(docker run --rm -v "$BACKUP_OUT_DIR":"$BACKUP_OUT_DIR" postgres:16-alpine \
    sh -lc "pg_restore -l '$BACKUP_FILE' | grep -vc '^;' || true")
  TABLE_DATA_COUNT=$(docker run --rm -v "$BACKUP_OUT_DIR":"$BACKUP_OUT_DIR" postgres:16-alpine \
    sh -lc "pg_restore -l '$BACKUP_FILE' | grep -c 'TABLE DATA' || true")
fi

cat > "$MANIFEST_FILE" <<EOF
source_container=$POSTGRES_CONTAINER_NAME
database=$POSTGRES_DB
created_at=$TIMESTAMP
archive=$BACKUP_FILE
format=custom
size_bytes=$BACKUP_SIZE
toc_entries=$TOC_ENTRY_COUNT
table_data_entries=$TABLE_DATA_COUNT
repo_root=$REPO_ROOT
EOF

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BACKUP_FILE" | awk '{print $1 "  " $2}' > "$SHA_FILE"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$SHA_FILE"
fi

ln -sfn "$BACKUP_FILE" "$BACKUP_OUT_DIR/latest.dump"
ln -sfn "$MANIFEST_FILE" "$BACKUP_OUT_DIR/latest.manifest.txt"
ln -sfn "$SHA_FILE" "$BACKUP_OUT_DIR/latest.sha256" 2>/dev/null || true

printf '%s\n' "$BACKUP_FILE"
