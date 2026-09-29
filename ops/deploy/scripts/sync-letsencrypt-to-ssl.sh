#!/usr/bin/env bash
# Copy Let's Encrypt live cert from the certbot Docker volume to /opt/vesta/ssl.
# Use when nginx still uses cycle-circle.selfsigned.conf (paths under /etc/nginx/ssl/).
# Prefer apply-letsencrypt-nginx.sh so nginx reads /etc/letsencrypt directly.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/vesta}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/ops/deploy/compose.prod.yml}"
CERT_NAME="${CERT_NAME:-cycle-circle.com}"
SSL_DIR="${SSL_DIR:-/opt/vesta/ssl}"
LIVE="/etc/letsencrypt/live/${CERT_NAME}"

cd "$REPO_ROOT"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -d "$SSL_DIR" ]]; then
  mkdir -p "$SSL_DIR"
  chmod 700 "$SSL_DIR"
fi

compose() {
  sg docker -c "docker compose -f ${COMPOSE_FILE} $*"
}

compose run --rm \
  -v "${SSL_DIR}:/out" \
  --entrypoint sh certbot -c "
    set -e
    test -f '${LIVE}/fullchain.pem'
    test -f '${LIVE}/privkey.pem'
    cp -L '${LIVE}/fullchain.pem' /out/fullchain.pem
    cp -L '${LIVE}/privkey.pem' /out/privkey.pem
    chmod 600 /out/fullchain.pem /out/privkey.pem
  "

echo "Synced ${CERT_NAME} from certbot volume → ${SSL_DIR}/"
openssl x509 -in "${SSL_DIR}/fullchain.pem" -noout -subject -issuer -dates
