#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buglogin/app}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
WEB_PORT="${WEB_PORT:-3003}"
API_PORT="${API_PORT:-12342}"
WEB_PROCESS="${WEB_PROCESS:-buglogin-web}"
API_PROCESS="${API_PROCESS:-buglogin-api}"
HEALTH_RETRIES="${HEALTH_RETRIES:-20}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-2}"

log() {
  printf '[deploy] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

healthcheck() {
  local name="$1"
  local url="$2"
  local try=1

  while [ "$try" -le "$HEALTH_RETRIES" ]; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "$name healthcheck passed: $url"
      return 0
    fi
    log "$name healthcheck retry $try/$HEALTH_RETRIES: $url"
    try=$((try + 1))
    sleep "$HEALTH_SLEEP_SECONDS"
  done

  log "$name healthcheck failed: $url"
  return 1
}

start_or_reload_pm2() {
  local name="$1"
  shift

  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 reload "$name" --update-env
  else
    pm2 start "$@"
  fi
}

require_cmd pnpm
require_cmd pm2
require_cmd curl
require_cmd git

cd "$APP_DIR"

if [ "$SKIP_GIT_PULL" != "1" ]; then
  log "Syncing git branch ($DEPLOY_BRANCH) with fast-forward only"
  if [ -n "$(git status --porcelain)" ]; then
    log "Working tree is dirty at $APP_DIR. Commit/stash changes first, or run with SKIP_GIT_PULL=1."
    exit 1
  fi
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH"
  git pull --ff-only origin "$DEPLOY_BRANCH"
else
  log "Skipping git pull (SKIP_GIT_PULL=1)"
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

mkdir -p buglogin-sync/.data
if [ ! -f buglogin-sync/.env ] && [ -f buglogin-sync/.env.example ]; then
  cp buglogin-sync/.env.example buglogin-sync/.env
fi

log "Installing dependencies (frozen lockfile)"
HUSKY=0 pnpm install --frozen-lockfile --prefer-offline --child-concurrency=2 --network-concurrency=8

log "Building web (Next.js production build)"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}" ./node_modules/.bin/next build --webpack

log "Building API (Nest production build)"
pnpm --filter buglogin-sync build

if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
  log "Missing Next.js build artifact (.next/BUILD_ID). Abort."
  exit 1
fi

if [ ! -f "$APP_DIR/buglogin-sync/dist/main.js" ]; then
  log "Missing API build artifact (buglogin-sync/dist/main.js). Abort."
  exit 1
fi

log "Reloading PM2 processes"
start_or_reload_pm2 "$WEB_PROCESS" pnpm --name "$WEB_PROCESS" --cwd "$APP_DIR" -- exec next start -p "$WEB_PORT"
start_or_reload_pm2 "$API_PROCESS" pnpm --name "$API_PROCESS" --cwd "$APP_DIR/buglogin-sync" -- start:prod

log "Running post-deploy healthchecks"
healthcheck "web" "http://127.0.0.1:${WEB_PORT}/signin"
healthcheck "api" "http://127.0.0.1:${API_PORT}/health"

pm2 save
pm2 status
log "Deploy completed successfully"
