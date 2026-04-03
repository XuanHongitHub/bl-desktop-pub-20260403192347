#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/buglogin/app"

cd "$APP_DIR"

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

mkdir -p buglogin-sync/.data
if [ ! -f buglogin-sync/.env ] && [ -f buglogin-sync/.env.example ]; then
  cp buglogin-sync/.env.example buglogin-sync/.env
fi

HUSKY=0 pnpm install --frozen-lockfile --child-concurrency=2 --network-concurrency=8
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}" ./node_modules/.bin/next build --webpack
cd buglogin-sync
pnpm build
cd ..

if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
  echo "Missing Next.js production build artifact (.next/BUILD_ID). Abort deploy."
  exit 1
fi

if [ ! -f "$APP_DIR/buglogin-sync/dist/main.js" ]; then
  echo "Missing API production build artifact (buglogin-sync/dist/main.js). Abort deploy."
  exit 1
fi

if pm2 describe buglogin-web >/dev/null 2>&1; then
  pm2 restart buglogin-web --update-env
else
  pm2 start pnpm --name buglogin-web --cwd "$APP_DIR" -- exec next start -p 3003
fi

if pm2 describe buglogin-api >/dev/null 2>&1; then
  pm2 restart buglogin-api --update-env
else
  pm2 start pnpm --name buglogin-api --cwd "$APP_DIR/buglogin-sync" -- start:prod
fi

pm2 save
pm2 status
