#!/usr/bin/env bash
# Production deploy, run on the VPS from /opt/vesta (GitHub Actions calls it over SSH;
# you can also run it by hand). Deploys the `production` branch:
#   fetch → checkout → prod-env guard → backup DB → build → migrate → restart web, check →
#   restart admin, check → confirm the live site is not in dev mode.
#
# Usage: bash ops/deploy/scripts/deploy.sh [expected-commit-sha]
# If a SHA is given, the deploy aborts unless origin/production points at it, so a run never
# deploys a newer push than the one that passed CI.
set -euo pipefail

REPO_DIR=/opt/vesta
BRANCH=production
# Compose interpolation needs BOTH env files. Passing any --env-file makes Compose skip the
# default ops/deploy/.env, so it must be listed explicitly:
#   ops/deploy/.env                    NGINX_CONF (443 config) and NEXT_PUBLIC_DEV_MODE (web build arg)
#   .env.monitoring.production         POSTGRES_EXPORTER_DSN, GRAFANA_ADMIN_* (compose.prod.yml includes monitoring)
# Missing the first serves the HTTP-only bootstrap nginx config; missing the second empties the exporter DSN.
COMPOSE=(docker compose)
for env_file in "$REPO_DIR/ops/deploy/.env" "$REPO_DIR/.env.monitoring.production"; do
  if [[ -f "$env_file" ]]; then
    COMPOSE+=(--env-file "$env_file")
  else
    echo "warning: $env_file not found; compose interpolation will use defaults" >&2
  fi
done
COMPOSE+=(-f ops/deploy/compose.prod.yml)
EXPECTED_SHA="${1:-}"

cd "$REPO_DIR"

echo "==> Fetching origin/$BRANCH"
git fetch --prune origin "$BRANCH"
TARGET_SHA=$(git rev-parse "origin/$BRANCH")
if [[ -n "$EXPECTED_SHA" && "$TARGET_SHA" != "$EXPECTED_SHA" ]]; then
  echo "origin/$BRANCH is $TARGET_SHA but this run was for $EXPECTED_SHA; a newer push will deploy itself. Aborting." >&2
  exit 1
fi
PREVIOUS_SHA=$(git rev-parse HEAD)

echo "==> Checking out $BRANCH at $TARGET_SHA (was $PREVIOUS_SHA)"
git checkout -B "$BRANCH" "origin/$BRANCH"

echo "==> Pre-flight: checking resolved compose config"
RESOLVED=$("${COMPOSE[@]}" config 2>/dev/null)
if grep -q "nginx/cycle-circle.bootstrap.conf" <<<"$RESOLVED"; then
  echo "nginx would get the HTTP-only bootstrap config (NGINX_CONF unset). Is ops/deploy/.env present? Aborting before any restart." >&2
  exit 1
fi
if grep -qE "DATA_SOURCE_NAME: \"?\"?$" <<<"$RESOLVED"; then
  echo "postgres-exporter DSN would be empty. Is .env.monitoring.production present? Aborting before any restart." >&2
  exit 1
fi

echo "==> Pre-flight: production env (real BDApps creds, dev mode off)"
# Aborts before any backup, build or restart (ALLOW_DEV_MODE=1 overrides on a staging box).
bash ops/deploy/scripts/check-prod-env.sh "$REPO_DIR"

echo "==> Backing up the database before migrating"
bash ops/deploy/scripts/backup-db.sh

echo "==> Building web and admin images"
"${COMPOSE[@]}" build web admin

echo "==> Applying Prisma migrations"
"${COMPOSE[@]}" run --rm --entrypoint sh web -c \
  "cd packages/shared && pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma"

WEB_URL=https://cycle-circle.com/login
ADMIN_URL=https://admin.cycle-circle.com/login

# Waits until a public site loads over HTTPS (2xx after redirects), up to ~2 minutes.
wait_live() {
  local name=$1 url=$2 service=$3
  for _ in $(seq 1 24); do
    if curl -fsSL -o /dev/null -m 10 "$url"; then
      echo "    $name is live ($url)"
      return 0
    fi
    sleep 5
  done
  echo "$name is not live at $url" >&2
  "${COMPOSE[@]}" logs --tail=80 "$service" nginx >&2 || true
  return 1
}

# Web first, then admin, so a broken build never takes both down (03-deployment.md §5).
echo "==> Restarting web"
"${COMPOSE[@]}" up -d web
wait_live web "$WEB_URL" web

echo "==> Restarting admin"
"${COMPOSE[@]}" up -d admin
wait_live admin "$ADMIN_URL" admin

echo "==> Making sure the rest of the stack is up"
"${COMPOSE[@]}" up -d
# `up -d` can recreate nginx, so check both sites again.
wait_live web "$WEB_URL" web
wait_live admin "$ADMIN_URL" admin

# The env files can be right while the running app is not (e.g. a stale image):
# check what users actually get.
assert_prod_mode() {
  [[ ${ALLOW_DEV_MODE:-} == 1 ]] && { echo "    skipping live dev-mode check (ALLOW_DEV_MODE=1)"; return 0; }
  local code
  if curl -fsSL -m 15 "$WEB_URL" | grep -q 'Dev mode'; then
    echo "The live login page shows \"Dev mode\": the web image was built with NEXT_PUBLIC_DEV_MODE=true." >&2
    return 1
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST https://cycle-circle.com/api/auth/dev-login \
    -H 'content-type: application/json' -d '{"phone":"01700000001"}')
  if [[ $code != 403 ]]; then
    echo "POST /api/auth/dev-login returned $code (expected 403): DEV_MODE is on in the running web container." >&2
    return 1
  fi
  echo "    live site is in production mode (no dev banner, dev login 403)"
}
echo "==> Checking the live site is not in dev mode"
assert_prod_mode

docker image prune -f >/dev/null || true

echo "==> Deployed $TARGET_SHA"
echo "    Roll back: git checkout $PREVIOUS_SHA, then rebuild and restart (03-deployment.md §5 Rollback)."
