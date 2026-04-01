#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
APP_STACK_NAME="${APP_STACK_NAME:-admin-dashboard-dev}"
STACK_ROOT="$REPO_ROOT/.docker/$APP_STACK_NAME"

mkdir -p \
  "$STACK_ROOT/storefront/node_modules" \
  "$STACK_ROOT/storefront/.next" \
  "$STACK_ROOT/channel-adapter/whatsapp-qr" \
  "$REPO_ROOT/backups/db"

printf '[prepare-dev-stack] prepared %s\n' "$STACK_ROOT"
