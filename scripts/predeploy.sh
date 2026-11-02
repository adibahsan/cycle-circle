#!/usr/bin/env bash
# The full local check set before a push to `production` (docs/LOCAL-DEVELOPMENT.md,
# "Checks before a deploy"). Runs each step in order with its own log and stops at the
# first failure. When E2E fails, the serial cron project is run on its own too, because a
# failure in any parallel project skips all of cron (e2e/README.md, "Serial cron project").
#
#   pnpm predeploy                 # logs go to a fresh temp dir, printed at the start
#   PREDEPLOY_LOG_DIR=/path pnpm predeploy
set -uo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="${PREDEPLOY_LOG_DIR:-$(mktemp -d -t vesta-predeploy)}"
mkdir -p "$LOG_DIR"
echo "[predeploy] logs: $LOG_DIR"

STEPS=(
  "typecheck|pnpm typecheck"
  "lint|pnpm lint"
  "docs-check|pnpm docs:check"
  "db-drift|pnpm db:drift"
  "shared-test|pnpm --filter @vesta/shared test"
  "web-test|pnpm --filter @vesta/web backend:test"
  "test-tz|pnpm test:tz"
  "e2e|pnpm e2e"
)

for step in "${STEPS[@]}"; do
  name="${step%%|*}"
  cmd="${step#*|}"
  log="$LOG_DIR/$name.log"
  start=$(date +%s)
  printf '[predeploy] %-12s ' "$name"
  if bash -c "$cmd" >"$log" 2>&1; then
    echo "ok ($(( $(date +%s) - start ))s)"
    continue
  fi
  echo "FAILED ($(( $(date +%s) - start ))s), see $log"
  if [ "$name" = "e2e" ]; then
    grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped)' "$log" | sed 's/^/[predeploy]   /'
    echo "[predeploy] running the cron project alone (skipped by the failure above)"
    if E2E_SKIP_BUILD=1 pnpm e2e -- --project=cron --no-deps >"$LOG_DIR/e2e-cron.log" 2>&1; then
      echo "[predeploy] cron        ok"
    else
      echo "[predeploy] cron        FAILED, see $LOG_DIR/e2e-cron.log"
    fi
  fi
  exit 1
done
echo "[predeploy] ALL GREEN"
