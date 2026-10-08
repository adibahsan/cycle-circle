# Archived public certificate chains

` *-fullchain.pem` files are **public** PEM chains (no private keys). They document which LE cert was live when archived; nginx on the VPS always uses the certbot volume, not this copy.

Refresh after re-issuance:

```bash
ssh vesta 'sg docker -c "docker compose -f /opt/vesta/ops/deploy/compose.prod.yml run --rm --entrypoint cat certbot /etc/letsencrypt/live/cycle-circle.com/fullchain.pem"' \
  > ops/deploy/tls/archives/cycle-circle.com-fullchain.pem
```
