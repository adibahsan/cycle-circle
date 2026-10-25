#!/usr/bin/env bash
# Refuses a production deploy that would run in dev mode or against a fake BDApps:
# real BDApps creds in the web and admin env files, DEV_MODE / NEXT_PUBLIC_DEV_MODE off,
# no simulator URL. deploy.sh runs it before backing up or building anything.
#
# Usage: bash ops/deploy/scripts/check-prod-env.sh [repo-dir]   (default /opt/vesta)
# A staging box that really wants dev mode sets ALLOW_DEV_MODE=1 (prints a warning).
set -euo pipefail

REPO_DIR="${1:-/opt/vesta}"
WEB_ENV="$REPO_DIR/.env.web.production"
ADMIN_ENV="$REPO_DIR/.env.admin.production"
BUILD_ENV="$REPO_DIR/ops/deploy/.env"

problems=()

# Last assignment of KEY in FILE, without quotes or CR; empty if unset. Files are read,
# never sourced: values like `Name <email>` are not valid bash.
val() {
  [[ -f $1 ]] || return 0
  grep -E "^[[:space:]]*$2=" "$1" | tail -n 1 | cut -d= -f2- | tr -d '\r' \
    | sed -E 's/^[[:space:]]+|[[:space:]]+$//g; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

fake_app_id() { [[ -z $1 || $1 == *PLACEHOLDER* || $1 == *SIMULATOR* || $1 == *DEV* || $1 == *TEST* ]]; }

for f in "$WEB_ENV" "$ADMIN_ENV"; do
  [[ -f $f ]] || problems+=("$f is missing")
done

if [[ -f $WEB_ENV ]]; then
  [[ $(val "$WEB_ENV" DEV_MODE) == true ]] && problems+=("DEV_MODE=true in $WEB_ENV (OTP bypass 420420, dev login, no BDApps calls)")
  [[ $(val "$WEB_ENV" NEXT_PUBLIC_DEV_MODE) == true ]] && problems+=("NEXT_PUBLIC_DEV_MODE=true in $WEB_ENV")
  [[ -n $(val "$WEB_ENV" BDAPPS_SIMULATOR_BASE_URL) ]] && problems+=("BDAPPS_SIMULATOR_BASE_URL is set in $WEB_ENV (calls would go to a simulator)")
  fake_app_id "$(val "$WEB_ENV" BDAPPS_APP_ID)" && problems+=("BDAPPS_APP_ID in $WEB_ENV is empty or a placeholder ($(val "$WEB_ENV" BDAPPS_APP_ID))")
  [[ -z $(val "$WEB_ENV" BDAPPS_PASSWORD) || $(val "$WEB_ENV" BDAPPS_PASSWORD) == *PLACEHOLDER* ]] && problems+=("BDAPPS_PASSWORD in $WEB_ENV is empty or a placeholder")
fi
if [[ -f $ADMIN_ENV ]]; then
  fake_app_id "$(val "$ADMIN_ENV" BDAPPS_APP_ID)" && problems+=("BDAPPS_APP_ID in $ADMIN_ENV is empty or a placeholder ($(val "$ADMIN_ENV" BDAPPS_APP_ID)); admin SMS broadcasts use it")
  [[ $(val "$ADMIN_ENV" DEV_MODE) == true ]] && problems+=("DEV_MODE=true in $ADMIN_ENV")
fi
# Auth tokens are scoped per app and environment (ADR 0007).
for f in "$WEB_ENV" "$ADMIN_ENV"; do
  [[ -f $f ]] || continue
  [[ -z $(val "$f" APP_ENV) ]] && problems+=("APP_ENV is not set in $f (production: APP_ENV=production)")
  [[ $(val "$f" JWT_SECRET) == local-dev* ]] && problems+=("JWT_SECRET in $f is a local-dev value")
done
if [[ -f $WEB_ENV && -f $ADMIN_ENV && -n $(val "$WEB_ENV" JWT_SECRET) && $(val "$WEB_ENV" JWT_SECRET) == "$(val "$ADMIN_ENV" JWT_SECRET)" ]]; then
  problems+=("JWT_SECRET is the same in web and admin env files (they must differ)")
fi
# The web image bakes NEXT_PUBLIC_DEV_MODE at build time from this compose build arg.
[[ $(val "$BUILD_ENV" NEXT_PUBLIC_DEV_MODE) == true ]] && problems+=("NEXT_PUBLIC_DEV_MODE=true in $BUILD_ENV (web build arg)")

if (( ${#problems[@]} == 0 )); then
  echo "    production env OK: real BDApps creds, dev mode off"
  exit 0
fi

printf '  - %s\n' "${problems[@]}" >&2
if [[ ${ALLOW_DEV_MODE:-} == 1 ]]; then
  echo "WARNING: ALLOW_DEV_MODE=1, deploying a non-production configuration anyway." >&2
  exit 0
fi
echo "Refusing to deploy: production must use real BDApps credentials with dev mode off (docs/ops/03-deployment.md §6). Fix the env files above, or set ALLOW_DEV_MODE=1 on a staging box." >&2
exit 1
