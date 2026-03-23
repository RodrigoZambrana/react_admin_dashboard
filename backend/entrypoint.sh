#!/bin/sh
set -e

sh ./scripts/ensure-db.sh
node dist/src/main.js
