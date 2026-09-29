#!/usr/bin/env bash
# Switch production nginx to cycle-circle.conf (Let's Encrypt paths in certbot volume).
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/vesta}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/ops/deploy/compose.prod.yml}"
ENV_FILE="${REPO_ROOT}/ops/deploy/.env"
NGINX_CONF="${NGINX_CONF:-cycle-circle.conf}"
CERT_NAME="${CERT_NAME:-cycle-circle.com}"

cd "$REPO_ROOT"

compose() {
  sg docker -c "docker compose -f ${COMPOSE_FILE} $*"
}

compose run --rm --entrypoint sh certbot -c "test -f /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem"

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^NGINX_CONF=' "$ENV_FILE"; then
    sed -i "s/^NGINX_CONF=.*/NGINX_CONF=${NGINX_CONF}/" "$ENV_FILE"
  else
    echo "NGINX_CONF=${NGINX_CONF}" >> "$ENV_FILE"
  fi
else
  echo "NGINX_CONF=${NGINX_CONF}" >> "$ENV_FILE"
fi

compose up -d --force-recreate nginx

echo "nginx recreated with NGINX_CONF=${NGINX_CONF}"
curl -fsS "https://cycle-circle.com/api/health/db" >/dev/null && echo "HTTPS health check OK (system trust store)"
