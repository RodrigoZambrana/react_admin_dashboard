#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RESET_SQL=$(mktemp /tmp/react_admin_dashboard_schema_reset.XXXXXX)

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
if [ "${LOCAL_TEST_ENV:-false}" != "true" ]; then
  case "$RUNTIME_ENV" in
    production|prod|live)
      echo "[bootstrap-schema] blocked: bootstrap-consolidated-schema-local-db.sh is disabled in production environments." >&2
      exit 1
      ;;
  esac
fi

: "${DATABASE_URL:?DATABASE_URL is required. Set it in backend/.env or export it before running this script.}"

if [ "${1:-}" != "--confirm" ]; then
  echo "[bootstrap-schema] blocked: destructive execution requires --confirm." >&2
  echo "[bootstrap-schema] example: npm run bootstrap:schema:local -- --confirm" >&2
  exit 1
fi

DB_HOST=$(node -e 'try { console.log(new URL(process.env.DATABASE_URL).hostname || "") } catch { console.log("") }')
case "$DB_HOST" in
  localhost|127.0.0.1|::1|db|postgres-local|codex-local-postgres|host.docker.internal)
    ;;
  *)
    if [ "${ALLOW_REMOTE_MAINTENANCE:-false}" != "true" ]; then
      echo "[bootstrap-schema] blocked: target database host \"$DB_HOST\" is not local." >&2
      echo "[bootstrap-schema] Use a local PostgreSQL target or set ALLOW_REMOTE_MAINTENANCE=true deliberately in a non-production environment." >&2
      exit 1
    fi
    ;;
esac

echo "[bootstrap-schema] Generating Prisma client..."
npx prisma generate >/dev/null

echo "[bootstrap-schema] Recreating public schema..."
cat > "$RESET_SQL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

npx prisma db execute --url "$DATABASE_URL" --file "$RESET_SQL" >/dev/null

echo "[bootstrap-schema] Applying consolidated Prisma baseline..."
npx prisma migrate deploy >/dev/null

echo "[bootstrap-schema] Regenerating Prisma client against current schema..."
npx prisma generate >/dev/null

echo "[bootstrap-schema] Done."
