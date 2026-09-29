#!/usr/bin/env bash
# Install vesta user crontab with CRON_SECRET from web production env.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/vesta}"
WEB_ENV="${WEB_ENV:-${REPO_ROOT}/.env.web.production}"
CRONTAB_SRC="${REPO_ROOT}/ops/deploy/vesta-crontab"
LOG_DIR=/var/log/vesta

if [[ ! -f "$WEB_ENV" ]]; then
  echo "error: missing ${WEB_ENV}" >&2
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$WEB_ENV" | cut -d= -f2- | tr -d '\r')
if [[ -z "$CRON_SECRET" || "$CRON_SECRET" == *PLACEHOLDER* ]]; then
  echo "error: set CRON_SECRET in ${WEB_ENV}" >&2
  exit 1
fi

sudo mkdir -p "$LOG_DIR"
sudo chown vesta:vesta "$LOG_DIR"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
sed "s/CRON_SECRET_PLACEHOLDER/${CRON_SECRET}/g" "$CRONTAB_SRC" > "$TMP"
crontab "$TMP"
echo "Installed crontab for $(whoami) ($(crontab -l | grep -c '^[0-9]' || true) jobs)"
