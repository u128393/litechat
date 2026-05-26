#!/usr/bin/env bash

set -euo pipefail

SSH_HOST="${SSH_HOST:-chat}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/litechat}"
SERVICE_NAME="${SERVICE_NAME:-litechat}"
DEPLOY_USER="${DEPLOY_USER:-litechat}"
DEPLOY_GROUP="${DEPLOY_GROUP:-litechat}"
TARGET="${TARGET:-x86_64-unknown-linux-musl}"
API_BINARY_NAME="${API_BINARY_NAME:-api}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
API_DIR="$ROOT_DIR/api"
APP_DIST_DIR="$APP_DIR/dist"
API_BINARY="$API_DIR/target/$TARGET/release/$API_BINARY_NAME"

REMOTE_UPLOAD_DIR="/tmp/litechat-deploy-$(date +%Y%m%d%H%M%S)-$$"
TMP_DIR="$(mktemp -d)"
APP_ARCHIVE="$TMP_DIR/app.tar.gz"
API_UPLOAD="$TMP_DIR/$API_BINARY_NAME"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

log() {
  printf '[deploy] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

require_command npm
require_command cargo
require_command tar
require_command scp
require_command ssh

log "Building frontend"
npm --prefix "$APP_DIR" run build

if [[ ! -d "$APP_DIST_DIR" ]]; then
  printf 'Frontend build output not found: %s\n' "$APP_DIST_DIR" >&2
  exit 1
fi

log "Packing frontend dist"
tar --no-xattrs -C "$APP_DIST_DIR" -czf "$APP_ARCHIVE" .

log "Building backend for $TARGET"
cargo zigbuild --manifest-path "$API_DIR/Cargo.toml" --release --target "$TARGET"

if [[ ! -f "$API_BINARY" ]]; then
  printf 'Backend binary not found: %s\n' "$API_BINARY" >&2
  exit 1
fi

cp "$API_BINARY" "$API_UPLOAD"

log "Uploading artifacts to $SSH_HOST:$REMOTE_UPLOAD_DIR"
ssh "$SSH_HOST" "mkdir -p '$REMOTE_UPLOAD_DIR'"
scp "$APP_ARCHIVE" "$SSH_HOST:$REMOTE_UPLOAD_DIR/app.tar.gz"
scp "$API_UPLOAD" "$SSH_HOST:$REMOTE_UPLOAD_DIR/api"

log "Preparing release on server"
ssh "$SSH_HOST" bash -s -- "$REMOTE_ROOT" "$REMOTE_UPLOAD_DIR" "$DEPLOY_USER" "$DEPLOY_GROUP" <<'REMOTE_PREPARE'
set -euo pipefail

remote_root="$1"
upload_dir="$2"
deploy_user="$3"
deploy_group="$4"

next_dir="$remote_root/next"

if ! id -u "$deploy_user" >/dev/null 2>&1; then
  printf 'Deploy user does not exist: %s\n' "$deploy_user" >&2
  exit 1
fi

if ! getent group "$deploy_group" >/dev/null 2>&1; then
  printf 'Deploy group does not exist: %s\n' "$deploy_group" >&2
  exit 1
fi

mkdir -p "$remote_root/shared"
rm -rf "$next_dir"
mkdir -p "$next_dir/app"

tar -xzf "$upload_dir/app.tar.gz" -C "$next_dir/app" --no-same-owner
install -o "$deploy_user" -g "$deploy_group" -m 0755 "$upload_dir/api" "$next_dir/api"
ln -s ../shared/.env "$next_dir/.env"
ln -s ../shared/data "$next_dir/data"

chown "$deploy_user:$deploy_group" "$next_dir"
chown -R "$deploy_user:$deploy_group" "$next_dir/app"
chown -h "$deploy_user:$deploy_group" "$next_dir/.env" "$next_dir/data"

rm -rf "$upload_dir"
REMOTE_PREPARE

log "Activating release"
ssh "$SSH_HOST" bash -s -- "$REMOTE_ROOT" "$SERVICE_NAME" <<'REMOTE_ACTIVATE'
set -euo pipefail

remote_root="$1"
service_name="$2"

current_dir="$remote_root/current"
previous_dir="$remote_root/previous"
next_dir="$remote_root/next"

print_service_diagnostics() {
  systemctl status "$service_name" --no-pager || true
  journalctl -u "$service_name" -n 80 --no-pager || true
}

rollback() {
  printf 'Service failed after deployment. Rolling back.\n' >&2
  systemctl stop "$service_name" || true

  rm -rf "$next_dir"

  if [[ -e "$current_dir" ]]; then
    mv "$current_dir" "$next_dir"
  fi

  if [[ -e "$previous_dir" ]]; then
    mv "$previous_dir" "$current_dir"
  else
    printf 'Rollback failed: previous release does not exist.\n' >&2
    print_service_diagnostics
    exit 1
  fi

  systemctl start "$service_name"

  if ! systemctl is-active --quiet "$service_name"; then
    printf 'Rollback failed: service is not active.\n' >&2
    print_service_diagnostics
    exit 1
  fi

  printf 'Rollback completed. Failed release remains at %s.\n' "$next_dir" >&2
  exit 1
}

if [[ ! -d "$next_dir" ]]; then
  printf 'Next release directory does not exist: %s\n' "$next_dir" >&2
  exit 1
fi

systemctl stop "$service_name" || true

rm -rf "$previous_dir"

if [[ -e "$current_dir" ]]; then
  mv "$current_dir" "$previous_dir"
fi

mv "$next_dir" "$current_dir"
systemctl start "$service_name"

if ! systemctl is-active --quiet "$service_name"; then
  rollback
fi

rm -rf "$next_dir"
printf 'Deployment completed.\n'
REMOTE_ACTIVATE

log "Done"
