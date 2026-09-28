# 05: TLS certificates and HTTPS nginx

**Status:** ready-for-agent

**What to build:** Let's Encrypt certificates issued via certbot; nginx serves HTTPS with apex/www/admin routing and HTTP→HTTPS redirect.

**Blocked by:** 03 (DNS for ACME), 04 (nginx serving ACME webroot)

- [ ] Certbot `certonly` succeeds for `cycle-circle.com`, `www`, `admin` using webroot challenge
- [ ] `NGINX_CONF=cycle-circle.conf` set in `ops/deploy/.env`; nginx recreated
- [ ] `curl -fsS https://cycle-circle.com/api/health/db` returns ok
- [ ] `https://admin.cycle-circle.com/login` returns 200
- [ ] `http://cycle-circle.com/` redirects to HTTPS
