#!/usr/bin/env bash
# Tests for check-prod-env.sh: the deploy refuses dev mode, placeholder BDApps creds and
# the simulator. Run: bash ops/deploy/scripts/test-check-prod-env.sh (part of `pnpm ops:test`).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="${HERE}/check-prod-env.sh"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

good() {
  rm -rf "$T/r"; mkdir -p "$T/r/ops/deploy"
  cat > "$T/r/.env.web.production" <<'ENV'
DATABASE_URL=postgresql://x
RESEND_FROM_EMAIL=Cycle Circle <noreply@cycle-circle.com>
BDAPPS_APP_ID=APP_140389
BDAPPS_PASSWORD="realpassword"
DEV_MODE=false
NEXT_PUBLIC_DEV_MODE=false
APP_ENV=production
JWT_SECRET=web-secret-0123456789abcdef0123456789abcdef
ENV
  printf 'BDAPPS_APP_ID=APP_140389\nBDAPPS_PASSWORD=realpassword\r\nAPP_ENV=production\nJWT_SECRET=admin-secret-0123456789abcdef0123456789abcd\n' > "$T/r/.env.admin.production"
  printf 'NGINX_CONF=nginx/cycle-circle.conf\nNEXT_PUBLIC_DEV_MODE=false\n' > "$T/r/ops/deploy/.env"
}

fail=0
expect() { # expect <pass|fail> <name> [env assignments...]
  local want=$1 name=$2; shift 2
  local out code=0
  out=$(env "$@" bash "$CHECK" "$T/r" 2>&1) || code=$?
  if [[ $want == pass && $code -ne 0 ]] || [[ $want == fail && $code -eq 0 ]]; then
    echo "FAIL: $name (exit $code)"; echo "$out" | sed 's/^/    /'; fail=1
  else
    echo "ok: $name"
  fi
}
set_kv() { sed -i.bak -E "s|^$2=.*|$2=$3|" "$1" && rm -f "$1.bak"; }

good; expect pass "real creds, dev mode off"
good; set_kv "$T/r/.env.web.production" DEV_MODE true; expect fail "DEV_MODE=true"
good; set_kv "$T/r/.env.web.production" NEXT_PUBLIC_DEV_MODE '"true"'; expect fail "quoted NEXT_PUBLIC_DEV_MODE=true in web env"
good; set_kv "$T/r/ops/deploy/.env" NEXT_PUBLIC_DEV_MODE true; expect fail "NEXT_PUBLIC_DEV_MODE=true build arg"
good; set_kv "$T/r/.env.web.production" BDAPPS_APP_ID APP_DEV_PLACEHOLDER; expect fail "placeholder web app id"
good; set_kv "$T/r/.env.admin.production" BDAPPS_APP_ID APP_SIMULATOR; expect fail "simulator admin app id"
good; set_kv "$T/r/.env.web.production" BDAPPS_PASSWORD ''; expect fail "empty BDApps password"
good; echo 'BDAPPS_SIMULATOR_BASE_URL=http://127.0.0.1:7002' >> "$T/r/.env.web.production"; expect fail "simulator base URL set"
good; echo 'BDAPPS_SIMULATOR_BASE_URL=' >> "$T/r/.env.web.production"; expect pass "simulator base URL empty"
good; rm "$T/r/.env.web.production"; expect fail "missing web env file"
good; set_kv "$T/r/.env.web.production" DEV_MODE true; expect pass "ALLOW_DEV_MODE=1 overrides (staging)" ALLOW_DEV_MODE=1
good; set_kv "$T/r/.env.admin.production" APP_ENV ''; expect fail "APP_ENV missing in admin env (ADR 0007)"
good; set_kv "$T/r/.env.web.production" JWT_SECRET local-dev-jwt-secret-minimum-32-characters-long; expect fail "local-dev JWT_SECRET in web env"
good; set_kv "$T/r/.env.admin.production" JWT_SECRET web-secret-0123456789abcdef0123456789abcdef; expect fail "web and admin share JWT_SECRET"

[[ $fail -eq 0 ]] && echo "PASS: check-prod-env" || { echo "check-prod-env tests failed"; exit 1; }
