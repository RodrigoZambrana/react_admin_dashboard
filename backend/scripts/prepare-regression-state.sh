#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$BACKEND_DIR"

npx ts-node --project tsconfig.seed.json --transpile-only scripts/prepare-regression-state.ts "$@"
