#!/usr/bin/env bash
# Smoke-test the four production BDApps listener endpoints.
# Requires the web app on BASE_URL (default http://localhost:3000).
# Leave BDAPPS_WEBHOOK_IPS unset (or empty) so IP allow-all applies in local/dev.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
STAMP="$(date -u +%Y%m%d%H%M%S)"
FAIL=0

ok() { echo "OK:   $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }

post() {
  local path="$1"
  local body="$2"
  local label="$3"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "$tmp" -w "%{http_code}" -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$body" || true)"
  local resp
  resp="$(cat "$tmp")"
  rm -f "$tmp"

  if [[ "$code" != "200" ]]; then
    fail "$label → HTTP $code — $resp"
    return
  fi
  if ! printf '%s' "$resp" | grep -q '"statusCode":"S1000"'; then
    # Allow pretty-printed JSON with spaces
    if ! printf '%s' "$resp" | grep -Eq '"statusCode"[[:space:]]*:[[:space:]]*"S1000"'; then
      fail "$label → missing statusCode S1000 — $resp"
      return
    fi
  fi
  ok "$label → HTTP 200 S1000"
}

echo "=== BDApps webhook smoke (${BASE_URL}) ==="

post "/api/webhooks/sms/receive" "{
  \"sourceAddress\": \"tel:8801812345678\",
  \"message\": \"webhook smoke ${STAMP}\",
  \"messageId\": \"smoke-sms-mo-${STAMP}\",
  \"timeStamp\": \"${STAMP}\"
}" "sms/receive"

post "/api/webhooks/sms/report" "{
  \"destinationAddress\": \"tel:8801812345678\",
  \"requestId\": \"smoke-sms-mt-${STAMP}\",
  \"deliveryStatus\": \"DELIVERED\",
  \"timeStamp\": \"${STAMP}\"
}" "sms/report"

post "/api/webhooks/ussd/receive" "{
  \"subscriberId\": \"tel:8801812345678\",
  \"ussdContent\": \"1\",
  \"sessionId\": \"smoke-ussd-${STAMP}\",
  \"status\": \"mo-init\"
}" "ussd/receive"

post "/api/webhooks/subscription/notify" "{
  \"subscriberId\": \"tel:8801812345678\",
  \"status\": \"ACTIVE\",
  \"reason\": \"webhook smoke ${STAMP}\",
  \"timeStamp\": \"${STAMP}\"
}" "subscription/notify"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All four BDApps listeners responded S1000."
  echo "Confirm persistence: WebhookEvent rows with types SMS_RECEIVE, SMS_REPORT, USSD_RECEIVE, SUBSCRIPTION_NOTIFY."
  exit 0
fi

echo "Webhook smoke failed. Is the web app running? (just w)"
exit 1
