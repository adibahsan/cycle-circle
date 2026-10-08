#!/usr/bin/env bash
# Production deploy, run on the VPS from /opt/vesta (GitHub Actions calls it over SSH;
# you can also run it by hand). Deploys the `production` branch:
#   fetch → checkout → backup DB → build → migrate → restart web, check → restart admin, check.
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

echo "==> Backing up the database before migrating"
bash ops/deploy/scripts/backup-db.sh

echo "==> Building web and admin images"
"${COMPOSE[@]}" build web admin

echo "==> Applying Prisma migrations"
"${COMPOSE[@]}" run --rm --entrypoint sh web -c \
  "cd packages/shared && pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma"

# Polls a URL from inside a container until it answers 2xx (up to ~2 minutes).
wait_healthy() {
  local service=$1 url=$2
  for _ in $(seq 1 24); do
    if "${COMPOSE[@]}" exec -T "$service" node -e \
      "fetch('$url').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      echo "    $service healthy ($url)"
      return 0
    fi
    sleep 5
  done
  echo "$service did not become healthy at $url" >&2
  "${COMPOSE[@]}" logs --tail=80 "$service" >&2 || true
  return 1
}

# Web first, then admin, so a broken build never takes both down (03-deployment.md §5).
echo "==> Restarting web"
"${COMPOSE[@]}" up -d web
wait_healthy web http://127.0.0.1:3000/api/health/db

echo "==> Restarting admin"
"${COMPOSE[@]}" up -d admin
wait_healthy admin http://127.0.0.1:3001/login

echo "==> Making sure the rest of the stack is up"
"${COMPOSE[@]}" up -d

docker image prune -f >/dev/null || true

echo "==> Deployed $TARGET_SHA"
echo "    Roll back: git checkout $PREVIOUS_SHA, then rebuild and restart (03-deployment.md §5 Rollback)."
