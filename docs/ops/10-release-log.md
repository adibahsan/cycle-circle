# Release log

One entry per production release (`main` → `production`). Newest first. For the release mechanics see [03-deployment.md §5](./03-deployment.md#5-routine-deploy).

---

## 2026-10-19 — Admin portal to SRS v1.4 (PR #105, tag 2.2.0)

**Shipped** (spec #84, tickets #85–#104):

- Admin access: 7-day admin login, a 403 "Not an admin" page, and suspension or deletion ends existing sessions on the next request in both apps.
- Billing safety (ADR 0006): Revoke, Suspend and Delete also unsubscribe the number on BDApps. An admin override ends when BDApps reports a new subscription. Deleted accounts can be restored for 30 days, then purged.
- Admin Logs page (merchant, webhook, translog; OTP codes masked) and a per-user plan history tab.
- Analytics on real data, with per-panel ranges and metrics, chart tables, and nightly MAE snapshots. The dashboard KPIs are at most 60 s old.
- SMS: CSV upload, a send-language choice, a part counter, queue edit and reschedule, and FAILED marking after retries.
- Articles: uploaded images stored on the server volume, the Bengali font in the editor, and publish warnings.
- Feedback filters (Dhaka dates, exact or minimum rating, search) and hardened CSV exports (BOM, quoting, formula prefix, audit log).
- Toasts and confirm dialogs across admin, a skip link, responsive stat grids, and focus rings.
- Grace period and CaaS admin views removed (`consecutiveFailures` and `gracePeriodEndsAt` columns dropped).

**Pre-deploy steps on the VPS**

1. `sudo install -d -m 0755 -o 1001 -g 1001 /var/lib/vesta/uploads` (it must exist before compose mounts it).

**Migrations** (applied by `deploy.sh`): `20261019100000_sms_queue`, `20261019102000_nightly_maintenance`, `20261019890000_sessions_valid_after`, `20261019920000_sms_send_language`, `20261019950000_revoke_unsubscribe`, `20261019990000_remove_grace_period`.

**Post-deploy steps on the VPS**

1. `bash /opt/vesta/ops/deploy/scripts/install-vesta-crontab.sh` adds the third, 02:30 UTC nightly-maintenance entry.
2. `docker compose -f ops/deploy/compose.prod.yml exec -T nginx sh -c 'nginx -t && nginx -s reload'` loads `client_max_body_size 6m` on admin.

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow.

---

## 2026-10-19 — Compact desktop layouts, Night blush dark mode, full logo (PR #83, tag 2.1.0)

**Shipped:**

- Dashboard compacted so the toolkit is in the first view at 1366×657 and up; the streak at-risk note stays inside its card.
- Every signed-in page fits one desktop screen with components sized to their content (no stretching): Insights, Settings, Subscription, Feedback, Calendar, Symptoms recomposed; pages use the full width beside the sidebar from xl.
- One shared month grid (`MonthGrid`) for Calendar and Symptoms; calendar days show logged-symptom icons from xl and the desktop calendar opens on today's details; Symptoms shows all four categories at once from 2xl.
- "Night blush" dark mode: near-black plum surfaces, jewel tints, cards lifted by a highlight and shadow instead of grey outlines; stronger calendar phase tints in dark.
- The full circular Cycle Circle logo replaces the drop mark in the shell, legal pages and landing footer, with a light-lettered dark variant (`public/brand/cycle-circle-logo-dark.svg`).
- Route skeletons rebuilt to mirror their pages.

**Pre-deploy steps on the VPS:** none. No schema migrations and no new env vars.

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow.

---

## 2026-10-18 — Portal redesign, wide screens, faster sign-in (PR #82)

**Shipped:**

- Spec #66 portal redesign: pastel look, honest dashboard data and the P1 accessibility fixes (#67–#76, #78–#81).
- Wide screens: every signed-in page recomposes into more columns instead of stretching; collapsible sidebar (240px / 72px rail).
- Today is marked with an accent ring and glow on the calendar and symptoms grids.
- Faster sign-in: OTP accepted → dashboard drops from ~1.5s to ~1.0s on a throttled phone. The shell's account, logging and completion data now stream from the server layout; new loading screens for the OTP page, Insights and onboarding.

**Pre-deploy steps on the VPS:** none. No schema migrations and no new env vars.

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow.

---

## 2026-10-18 — BDApps subscription, file logging, UI audit (PR #61)

**Shipped** (supersedes PRs #57–#60):

- Phone login is the BDApps subscription; email users are Free until they verify a phone; Unsubscribe button; nightly `getStatus` check ([ADR 0002](../adr/0002-phone-login-is-the-bdapps-subscription.md)).
- Masked subscriber ids stored and used for status, unsubscribe and webhooks ([09-bdapps-subscriptions.md](./09-bdapps-subscriptions.md)).
- File logging: six channels under `/var/log/vesta/app`, Dhaka-dated files, retention script ([ADR 0004](../adr/0004-server-logs-are-dated-files-per-channel.md), [08-logging.md](./08-logging.md)).
- Server-rendered UI language via the `vesta_lang` cookie ([ADR 0003](../adr/0003-ui-language-lives-in-a-cookie.md)); every route is now dynamic.
- Security: `/api/auth/status` no longer returns the raw user row (it leaked `passwordHash`).
- UI audit (`review/UI-AUDIT-2026-10-17.html`) and a green e2e suite (164/164).

**Pre-deploy steps on the VPS**

1. `sudo install -d -m 0750 -o 1001 -g 1001 /var/log/vesta/app`
2. Root crontab: `15 0 * * * /opt/vesta/ops/deploy/scripts/log-retention.sh >> /var/log/vesta/log-retention.log 2>&1`
3. Admin grant for the two legacy Pro phone users: **not required** — the nightly check skips raw-phone rows (see 09 §2).

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow.

**Deploys**

1. `a89becb` via GitHub Actions *Production* (run 39074479252): checks + deploy green. The VPS was still on **staging flags** (`DEV_MODE=true`, `NEXT_PUBLIC_DEV_MODE=true`, `BDAPPS_APP_ID=APP_DEV_PLACEHOLDER`), so the live site showed "Dev mode" and accepted `420420`.
2. **Go-live (same commit):** env switched to real BDApps, then `bash ops/deploy/scripts/deploy.sh` on the VPS to rebuild web (the `NEXT_PUBLIC_` flag is baked at build time).
   - `.env.web.production`: `BDAPPS_APP_ID=APP_140389`, real `BDAPPS_PASSWORD`, `DEV_MODE=false`, `NEXT_PUBLIC_DEV_MODE=false`, no `BDAPPS_SIMULATOR_BASE_URL`.
   - `.env.admin.production`: real `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` (SMS broadcasts).
   - `ops/deploy/.env`: `NEXT_PUBLIC_DEV_MODE=false`.
   - Backups on the VPS: `/opt/vesta/.env.web.production.bak-20261017-223519`, `ops/deploy/.env.bak-20261017-223519`, `.env.admin.production.bak-20261017-223547`.
   - `BDAPPS_WEBHOOK_IPS` stays empty (allow-all, still guarded by the `applicationId` check) until BDApps confirms its egress IPs; seen so far: `202.134.12.117`.

**Verification (2026-10-18 04:46 Dhaka)**

| Check | Result |
|---|---|
| `cycle-circle.com/login`, `admin.cycle-circle.com/login`, `/api/health/db` | 200 |
| Login page | no "Dev mode" text |
| `POST /api/auth/dev-login` | 403 (dev bypass off) |
| `/api/auth/status` unauthenticated | 401; authenticated response is an 11-field allowlist |
| `vesta_lang=bn` | server renders `<html lang="bn">` |
| Containers | web + admin mount `/var/log/vesta/app`, `LOG_DIR` set |
| Manual `caas-check` | `{"checked":2,"downgraded":0,"skipped":2,"errors":0}`: real `getStatus` calls, E1951 on the two legacy raw-phone ids, skipped as designed |
| Logs | `merchant/`, `cron/` lines written with a shared `requestId`; password redacted |

**Known, harmless:** one `redis.fallback` (connect `ETIMEDOUT`, 1 s timeout) at container start; ioredis reconnects and `redis:6379` is reachable.

**Real-number end-to-end test on production (2026-10-18, Robi `01805718862`)**

| Step (Dhaka time) | Result |
|---|---|
| 04:48:21 OTP verify | `S1000`, `subscriptionStatus: INITIAL CHARGING PENDING`, masked `subscriberId` stored; user shown Pro (`cause=otp-verify`) |
| 04:49:06 webhook `subscription.notify` from `202.134.12.117` | `REGISTERED`, `frequency: daily`; matched by masked id, synced |
| `getStatus` with the masked id | `REGISTERED` |
| 04:58:43 Unsubscribe button | `subscription/send action 0` → `UNREGISTERED`; user FREE (`cause=unsubscribe`); webhook `UNREGISTERED` synced in the same second; `query-base` 0 |
| Direct subscribe without OTP | rejected (`E1951`) for raw and masked ids; see [09](./09-bdapps-subscriptions.md) |

Found: a wrong OTP (`E1850`) reaches the browser as 502 and is logged as an error (should be 400 / warn); unsubscribe and its webhook both write a `PRO→FREE` translog line. Masked ids change per subscription. One `subscription.notify` at 04:37 was rejected (401, placeholder app id still running) during the switchover.
