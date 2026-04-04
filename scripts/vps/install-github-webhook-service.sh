#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buglogin/app}"
SERVICE_NAME="${SERVICE_NAME:-buglogin-github-webhook}"
WEBHOOK_PORT="${WEBHOOK_PORT:-9912}"
WEBHOOK_HOST="${WEBHOOK_HOST:-127.0.0.1}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/github/deploy}"
WEBHOOK_REPO="${WEBHOOK_REPO:-keyduc91/Malvanut-Login}"
WEBHOOK_REF="${WEBHOOK_REF:-refs/heads/main}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Missing WEBHOOK_SECRET env."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found."
  exit 1
fi

mkdir -p /etc/buglogin
cat >"/etc/buglogin/github-webhook.env" <<EOF
WEBHOOK_PORT=$WEBHOOK_PORT
WEBHOOK_HOST=$WEBHOOK_HOST
WEBHOOK_PATH=$WEBHOOK_PATH
WEBHOOK_REPO=$WEBHOOK_REPO
WEBHOOK_REF=$WEBHOOK_REF
WEBHOOK_SECRET=$WEBHOOK_SECRET
WEBHOOK_DEPLOY_CMD=cd $APP_DIR && VERIFY_STRICT=1 bash scripts/deploy-vps-web-api.sh
EOF
chmod 600 /etc/buglogin/github-webhook.env

cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=BugLogin GitHub Push Webhook Receiver
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/buglogin/github-webhook.env
ExecStart=/usr/bin/env node $APP_DIR/scripts/vps/github-push-webhook.mjs
Restart=always
RestartSec=2
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"
systemctl status "${SERVICE_NAME}.service" --no-pager

echo "Installed service: ${SERVICE_NAME}"
echo "Webhook URL: http://${WEBHOOK_HOST}:${WEBHOOK_PORT}${WEBHOOK_PATH}"
