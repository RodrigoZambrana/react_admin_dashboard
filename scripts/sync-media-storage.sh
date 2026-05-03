#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

STORAGE_ROOT="${MEDIA_STORAGE_ROOT:-$REPO_ROOT/../urucortinas-storage}"
SOURCE_MEDIA="$REPO_ROOT/backend/media"
SOURCE_UPLOADS="$REPO_ROOT/backend/uploads"
TARGET_MEDIA="$STORAGE_ROOT/media"
TARGET_UPLOADS="$STORAGE_ROOT/uploads"

MODE="${1:-bootstrap}"

log() {
  printf '[sync-media-storage] %s\n' "$1"
}

ensure_dirs() {
  mkdir -p "$TARGET_MEDIA" "$TARGET_UPLOADS"
}

sync_dir() {
  src=$1
  dst=$2
  if [ ! -d "$src" ]; then
    log "source directory not found: $src"
    exit 1
  fi

  mkdir -p "$dst"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src"/ "$dst"/
  else
    rm -rf "$dst"/*
    cp -R "$src"/. "$dst"/
  fi
}

dir_has_entries() {
  dir=$1
  find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | grep -q .
}

case "$MODE" in
  bootstrap)
    ensure_dirs
    if [ -z "$(find "$TARGET_MEDIA" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1 || true)" ]; then
      log "bootstrapping media into $TARGET_MEDIA"
      sync_dir "$SOURCE_MEDIA" "$TARGET_MEDIA"
    else
      log "media storage already initialized: $TARGET_MEDIA"
    fi

    if [ -z "$(find "$TARGET_UPLOADS" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1 || true)" ]; then
      log "bootstrapping uploads into $TARGET_UPLOADS"
      sync_dir "$SOURCE_UPLOADS" "$TARGET_UPLOADS"
    else
      log "uploads storage already initialized: $TARGET_UPLOADS"
    fi
    ;;
  push)
    ensure_dirs
    log "syncing repo storage -> external storage root"
    sync_dir "$SOURCE_MEDIA" "$TARGET_MEDIA"
    sync_dir "$SOURCE_UPLOADS" "$TARGET_UPLOADS"
    ;;
  pull)
    if [ ! -d "$TARGET_MEDIA" ] || [ ! -d "$TARGET_UPLOADS" ]; then
      log "external storage root not initialized: $STORAGE_ROOT"
      exit 1
    fi
    if ! dir_has_entries "$TARGET_MEDIA"; then
      log "external media storage is empty: $TARGET_MEDIA"
      exit 1
    fi
    if ! dir_has_entries "$TARGET_UPLOADS"; then
      log "external uploads storage is empty: $TARGET_UPLOADS"
      exit 1
    fi
    ensure_dirs
    log "syncing external storage root -> repo storage"
    sync_dir "$TARGET_MEDIA" "$SOURCE_MEDIA"
    sync_dir "$TARGET_UPLOADS" "$SOURCE_UPLOADS"
    ;;
  status)
    log "storage root: $STORAGE_ROOT"
    log "media: $(find "$TARGET_MEDIA" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ') top-level entries"
    log "uploads: $(find "$TARGET_UPLOADS" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ') top-level entries"
    ;;
  *)
    cat <<EOF
Usage: $0 [bootstrap|push|pull|status]

  bootstrap  Initialize the external storage root from the repository copy if empty.
  push       Copy the current repository media/uploads into the external storage root.
  pull       Copy the external storage root back into the repository tree.
  status     Print a short storage summary.

Environment:
  MEDIA_STORAGE_ROOT   Overrides the external storage root (default: ../urucortinas-storage)
EOF
    exit 1
    ;;
esac
