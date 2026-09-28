# 08: Production go-live (BDApps, Resend, DEV_MODE off)

**Status:** ready-for-agent

**What to build:** Real billing, webhooks, and email paths enabled; dev OTP bypass disabled; external integrations registered against production URLs.

**Blocked by:** 05, 06, 07

- [ ] Real BDApps credentials and `BDAPPS_WEBHOOK_IPS` set; four webhook URLs registered in BDApps portal
- [ ] Webhook allowlist rejects non-BDApps IPs (401 from host curl smoke)
- [ ] Resend webhook registered; `RESEND_WEBHOOK_SECRET` set; delivery events update email logs
- [ ] `DEV_MODE=false`; web image **rebuilt** with `NEXT_PUBLIC_DEV_MODE=false`
- [ ] OTP codes `420420` / `840840` no longer authenticate on production login
- [ ] Routine deploy doc path verified: `git pull`, build, migrate, `up -d`, health check
