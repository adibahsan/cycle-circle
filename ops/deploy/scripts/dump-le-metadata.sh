#!/usr/bin/env bash
# Print JSON metadata for the active Let's Encrypt cert (no private key). Paste into ops/deploy/tls/production-inventory.json.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/vesta}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/ops/deploy/compose.prod.yml}"
CERT_NAME="${CERT_NAME:-cycle-circle.com}"

cd "$REPO_ROOT"

sg docker -c "docker compose -f ${COMPOSE_FILE} run --rm --entrypoint sh certbot -c \"
  set -e
  F=/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem
  test -f \\\"\\\$F\\\"
  END=\\\$(openssl x509 -in \\\"\\\$F\\\" -noout -enddate | cut -d= -f2)
  SUBJ=\\\$(openssl x509 -in \\\"\\\$F\\\" -noout -subject -nameopt RFC2253 | sed 's/subject=//')
  ISS=\\\$(openssl x509 -in \\\"\\\$F\\\" -noout -issuer -nameopt RFC2253 | sed 's/issuer=//')
  SANS=\\\$(openssl x509 -in \\\"\\\$F\\\" -noout -ext subjectAltName 2>/dev/null | tail -1 | sed 's/^[[:space:]]*//')
  printf '{\\\"updatedAt\\\":\\\"%s\\\",\\\"certificateName\\\":\\\"${CERT_NAME}\\\",\\\"subject\\\":\\\"%s\\\",\\\"issuer\\\":\\\"%s\\\",\\\"notAfter\\\":\\\"%s\\\",\\\"subjectAltName\\\":\\\"%s\\\"}\\n' \\\"\$(date -u +%Y-%m-%d)\\\" \\\"\\\$SUBJ\\\" \\\"\\\$ISS\\\" \\\"\\\$END\\\" \\\"\\\$SANS\\\"
\""
