# 05: TLS certificates and HTTPS nginx

**Status:** ready-for-human

**What to build:** Let's Encrypt certificates issued via certbot; nginx serves HTTPS with apex/www/admin routing and HTTP→HTTPS redirect.

**Blocked by:** 03 (DNS for ACME), 04 (nginx serving ACME webroot)

**Interim (2026-09-28):** Self-signed OpenSSL cert at `/opt/vesta/ssl/`, `NGINX_CONF=cycle-circle.selfsigned.conf` — HTTPS live on apex; replace with Let's Encrypt before go-live.

- [ ] Certbot `certonly` succeeds for `cycle-circle.com`, `www`, `admin` using webroot challenge
- [ ] `NGINX_CONF=cycle-circle.conf` set in `ops/deploy/.env`; nginx recreated (after LE)
- [x] `curl -kfsS https://cycle-circle.com/api/health/db` returns ok (self-signed)
- [ ] `https://admin.cycle-circle.com/login` returns 200 (needs admin DNS + trusted or `-k` cert)
- [x] `http://cycle-circle.com/` redirects to HTTPS
