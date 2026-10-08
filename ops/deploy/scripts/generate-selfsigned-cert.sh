#!/usr/bin/env bash
# Generate a self-signed TLS cert for staging HTTPS on the VPS.
# Output: /opt/vesta/ssl/fullchain.pem and privkey.pem (mode 600, owner vesta).
set -euo pipefail

SSL_DIR="${1:-/opt/vesta/ssl}"
DAYS="${SELF_SIGNED_DAYS:-365}"
CN="${SELF_SIGNED_CN:-cycle-circle.com}"

if [[ ! -d "$SSL_DIR" ]]; then
  mkdir -p "$SSL_DIR"
  chmod 700 "$SSL_DIR"
elif [[ ! -w "$SSL_DIR" ]]; then
  echo "error: ${SSL_DIR} exists but is not writable (often created as root by Docker). Run: sudo chown -R \$(whoami):\$(whoami) ${SSL_DIR}" >&2
  exit 1
fi

openssl req -x509 -nodes -newkey rsa:2048 -days "$DAYS" \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/CN=${CN}" \
  -addext "subjectAltName=DNS:cycle-circle.com,DNS:www.cycle-circle.com,DNS:admin.cycle-circle.com,DNS:monitoring.cycle-circle.com"

chmod 600 "$SSL_DIR/privkey.pem" "$SSL_DIR/fullchain.pem"
echo "Wrote ${SSL_DIR}/fullchain.pem and privkey.pem (${DAYS}d, SAN: apex/www/admin/monitoring)"
