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
./node_modules/.bin/next build
cd buglogin-sync
pnpm build
cd ..

pm2 delete buglogin-web >/dev/null 2>&1 || true
pm2 delete buglogin-api >/dev/null 2>&1 || true

pm2 start pnpm --name buglogin-web --cwd "$APP_DIR" -- exec next start -p 3003
pm2 start pnpm --name buglogin-api --cwd "$APP_DIR/buglogin-sync" -- start:prod
pm2 save
pm2 status
