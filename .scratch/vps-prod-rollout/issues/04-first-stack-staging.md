# 04: First stack bring-up (staging mode)

**Status:** ready-for-human

**What to build:** The full Compose stack runs on the VPS with bootstrap HTTP nginx; database migrated and admin seeded; web and admin reachable over HTTP for smoke tests before TLS.

**Blocked by:** 02, 03

- [x] `docker compose build` web + admin (staging `NEXT_PUBLIC_DEV_MODE=true`)
- [x] Postgres/Redis healthy; migrations applied
- [x] Admin seeded `admin@cycle-circle.com` (password on ops machine `/tmp/vesta-admin-creds.txt` — rotate/store in PM)
- [x] All services Up (nginx bootstrap HTTP)
- [ ] Public HTTP smoke on hostnames (needs **admin** DNS for admin vhost)
- [x] `curl -H 'Host: cycle-circle.com' http://127.0.0.1/api/health/db` → ok on VPS
