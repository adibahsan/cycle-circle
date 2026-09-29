# 05: TLS certificates and HTTPS nginx

**Status:** resolved

**What to build:** Let's Encrypt certificates issued via certbot; nginx serves HTTPS with apex/www/admin routing and HTTP→HTTPS redirect.

**Blocked by:** 03 (DNS for ACME), 04 (nginx serving ACME webroot)

- [x] Certbot `certonly` succeeds for `cycle-circle.com`, `www`, `admin` using webroot challenge
- [x] `NGINX_CONF=cycle-circle.conf` set in `ops/deploy/.env`; nginx recreated (2026-09-29 via `apply-letsencrypt-nginx.sh`)
- [x] `curl -fsS https://cycle-circle.com/api/health/db` returns ok (Let's Encrypt)
- [x] `https://admin.cycle-circle.com/login` returns 200 (LE)
- [x] `http://cycle-circle.com/` redirects to HTTPS
- [ ] `monitoring.cycle-circle.com` on certificate SAN (defer to monitoring go-live / cert re-issue)

## Answer

LE cert in certbot volume; nginx on production TLS config. Repo: `ops/deploy/scripts/apply-letsencrypt-nginx.sh`, `sync-letsencrypt-to-ssl.sh`, `ops/deploy/tls/production-inventory.json`.
