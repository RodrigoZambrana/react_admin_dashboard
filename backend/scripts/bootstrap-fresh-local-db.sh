#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RESET_SQL=$(mktemp /tmp/react_admin_dashboard_reset.XXXXXX.sql)

cleanup() {
  rm -f "$RESET_SQL"
}

trap cleanup EXIT

cd "$BACKEND_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
  eval "$(
    python3 - <<'PY'
from pathlib import Path
import shlex

wanted = {
    "DATABASE_URL",
    "DEFAULT_ADMIN_PASSWORD",
    "DEFAULT_ADMIN_EMAIL",
    "DEFAULT_ADMIN_NAME",
    "NODE_ENV",
    "APP_ENV",
    "ENVIRONMENT",
    "RUNTIME_ENV",
}

for raw_line in Path(".env").read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key not in wanted:
        continue
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    print(f"export {key}={shlex.quote(value)}")
PY
  )"
fi

RUNTIME_ENV=$(printf '%s' "${RUNTIME_ENV:-${APP_ENV:-${NODE_ENV:-${ENVIRONMENT:-unknown}}}}" | tr '[:upper:]' '[:lower:]')
case "$RUNTIME_ENV" in
  production|prod|live)
    echo "[bootstrap] blocked: bootstrap-fresh-local-db.sh is disabled in production environments." >&2
    exit 1
    ;;
esac

: "${DATABASE_URL:?DATABASE_URL is required. Set it in backend/.env or export it before running this script.}"

if [ "${1:-}" != "--confirm" ]; then
  echo "[bootstrap] blocked: destructive execution requires --confirm." >&2
  echo "[bootstrap] example: npm run bootstrap:fresh:local -- --confirm" >&2
  exit 1
fi

DB_HOST=$(node -e 'try { console.log(new URL(process.env.DATABASE_URL).hostname || "") } catch { console.log("") }')
case "$DB_HOST" in
  localhost|127.0.0.1|::1|postgres-local|codex-local-postgres|host.docker.internal)
    ;;
  *)
    if [ "${ALLOW_REMOTE_MAINTENANCE:-false}" != "true" ]; then
      echo "[bootstrap] blocked: target database host \"$DB_HOST\" is not local." >&2
      echo "[bootstrap] Use a local PostgreSQL target or set ALLOW_REMOTE_MAINTENANCE=true deliberately in a non-production environment." >&2
      exit 1
    fi
    ;;
esac

: "${DEFAULT_ADMIN_PASSWORD:?DEFAULT_ADMIN_PASSWORD is required to create/reset the bootstrap admin.}"

DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-desarrollo@software-strategy.com}"
DEFAULT_ADMIN_NAME="${DEFAULT_ADMIN_NAME:-Local Admin}"

echo "[bootstrap] Generating Prisma client..."
npx prisma generate >/dev/null

echo "[bootstrap] Recreating public schema..."
cat > "$RESET_SQL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

npx prisma db execute --url "$DATABASE_URL" --file "$RESET_SQL" >/dev/null

echo "[bootstrap] Applying official Prisma migrations..."
npx prisma migrate deploy >/dev/null

echo "[bootstrap] Seeding minimal baseline and bootstrap admin..."
SEED_BASELINE=true \
SEED_SUPERADMIN_EMAIL="$DEFAULT_ADMIN_EMAIL" \
SEED_SUPERADMIN_NAME="$DEFAULT_ADMIN_NAME" \
SEED_SUPERADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD" \
ENABLE_DEMO_SEED=false \
npx prisma db seed >/dev/null

echo "[bootstrap] Regenerating Prisma client against current schema..."
npx prisma generate >/dev/null

echo "[bootstrap] Done."
echo "[bootstrap] Admin email: $DEFAULT_ADMIN_EMAIL"
echo "[bootstrap] Baseline fixture: $BACKEND_DIR/prisma/baseline/urucortinas_minimal_baseline.json"
