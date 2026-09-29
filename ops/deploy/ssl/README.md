# TLS material (never commit private keys)

Production certificates are **secrets**. They live only on the VPS:

| Location | Purpose |
|----------|---------|
| Docker volume `certbot_conf` | Canonical Let's Encrypt store (`/etc/letsencrypt/live/cycle-circle.com/` inside certbot/nginx) |
| `/opt/vesta/ssl/*.pem` | Optional **mirror** when `NGINX_CONF=cycle-circle.selfsigned.conf` points nginx at `/etc/nginx/ssl/` |

This directory is a **placeholder in git** only. PEM files here or under `/opt/vesta/ssl` must stay **gitignored**.

**Repo-owned (safe to commit):**

- Nginx configs: `ops/deploy/nginx/cycle-circle*.conf`
- Scripts: `ops/deploy/scripts/apply-letsencrypt-nginx.sh`, `sync-letsencrypt-to-ssl.sh`, `dump-le-metadata.sh`
- Non-secret inventory: `ops/deploy/tls/production-inventory.json`

After issuance, prefer **`apply-letsencrypt-nginx.sh`** (`NGINX_CONF=cycle-circle.conf`, nginx reads the certbot volume directly). Use **`sync-letsencrypt-to-ssl.sh`** only for the interim self-signed config path or emergency mirror.
