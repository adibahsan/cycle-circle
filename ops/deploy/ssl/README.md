# TLS material (never commit private keys)

Production certificates are **secrets**. They live only on the VPS, in the Docker volume `certbot_conf` (Let's Encrypt store, mounted at `/etc/letsencrypt/` in certbot and nginx). `ops/deploy/nginx/cycle-circle.conf` reads `/etc/letsencrypt/live/cycle-circle.com/` directly.

This directory is a **placeholder in git** only. Any PEM files here must stay **gitignored**.

**Repo-owned (safe to commit):**

- Nginx configs: `ops/deploy/nginx/cycle-circle.bootstrap.conf` (HTTP, pre-cert) and `cycle-circle.conf` (Let's Encrypt)
- Scripts: `ops/deploy/scripts/apply-letsencrypt-nginx.sh`, `dump-le-metadata.sh`
- Non-secret inventory: `ops/deploy/tls/production-inventory.json`
