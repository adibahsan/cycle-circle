# Release log

One entry per production release (`main` → `production`). Newest first. For the release mechanics see [03-deployment.md §5](./03-deployment.md#5-routine-deploy).

---

## 2026-11-01 — Article management: search, bulk actions, scheduling, views, category order (PRs #228, #194, tag 2.4.0)

**Shipped:**

- **#228, article management** (spec #193, tickets #213–#218):
  - **Search and filters (#213):** the admin article list searches all articles by English or Bangla title on the server. It filters by status, category (including "No category"), cycle phase and "Missing Bangla". Filters, page and sort are kept in the URL.
  - **Errors and validation (#213):** every content action returns its real error message, and a failed delete closes the confirm and shows it. The server refuses a blank English title or body, an invalid phase or an unknown category.
  - **Bulk actions (#214):** select articles, then Publish, Unpublish, Archive or Move to category, and see how many succeeded and which failed. Delete stays one at a time. Bulk publish keeps an already-live article's publish time.
  - **Scheduled publishing (#215):** set a publish date-time, entered and shown in Bangladesh time. The list shows "Scheduled" with its time, and the "Articles by Status" chart counts it separately. The schedule can be changed or cancelled before it goes live. No cron: customers see an article when it is published and its published-at is at or before now. The Learn list is cached for 60 s, so it appears within a minute, and `/content/<id>` is not-found until then.
  - **Article views (#216):** one view per user per article per Bangladesh day, recorded when a customer opens `/content/<id>`. The admin list has a Views column, sorts by most or least read, and takes a from–to range of Bangladesh days.
  - **Category order (#217):** categories are reordered by dragging, or with Move up/Move down from the keyboard. Learn shows category filter chips in that order. Bangla-only names get unique slugs (`category`, `category-2`, …).
  - **Audit:** new actions for an article update, a bulk action (with ids) and a category create/rename/delete/reorder.
  - **Editor typography (#218):** the admin editor and the customer reader share one stylesheet (`packages/shared/src/styles/article-typography.css`), so headings, lists and quotes look alike.
- **#194, Learn articles on their own URL:** the reader moved from a modal to `/content/<id>`. Merged as part of #228.

**Migrations** (applied by `deploy.sh` after its backup, both additive):
- `20261101190000_article_category_sort_order`: `ArticleCategory.sortOrder`, backfilled in name order. Production had no categories, so the backfill was a no-op.
- `20261101200000_article_views`: new `ArticleView` table, keyed by (article, user, Bangladesh day).

**Behaviour change:** a PUBLISHED article with no published-at, or one in the future, is now hidden from customers. Before the deploy, production had one published article, with a past published-at, so nothing disappeared.

**Post-deploy steps on the VPS:** none. No new env vars or crons.

**Verification (2026-11-01 ~08:20 Dhaka)**

| Check | Result |
|---|---|
| `cycle-circle.com/login`, `admin.cycle-circle.com/login`, `/api/health/db` | 200 |
| `POST /api/auth/dev-login` | 403 |
| `/content`, `/content/<id>`, admin `/content` signed out | 307 to login |
| `_prisma_migrations` | both migrations finished |
| Published articles visible under the new rule | 1 of 1 |
| `/var/log/vesta/app/error/` after the deploy | no entries |

**Known:** the admin E2E test "SMS daily send time" times out in CI under the full suite. It failed the same way before this release. Tracked in #229.

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow (run 41264003086).

---

## 2026-11-01 — Insights & reports, SMS campaigns, admin-set Pro price, admin P0 security (PRs #219, #222–#226, tag 2.3.0)

**Shipped:**

- **#226, Insights & reports** (spec #192, tickets #206–#212):
  - **Overview:** the admin home is now the business Overview. It shows total users, new signups, active users, Pro subscribers, churn by reason with the churn rate (admin revokes excluded), and estimated daily revenue from the Pro price history. Every number shows the % change against the previous period.
  - **Active users:** recorded per Bangladesh day from this release on. A user counts when they open the signed-in app, onboarding included.
  - **Shared range:** 7/30/90 days or a custom from–to in Bangladesh days, up to 366 days, kept in the URL. It covers Overview, Analytics, Engagement, Subscriptions, Campaign history, Feedback and Emails, and every panel ends at the end of the Bangladesh day.
  - **CSV:** every chart and table exports CSV, with a BOM and formula-injection escaping.
  - **Emailed reports:** weekly (Sunday 09:00 Bangladesh time) and monthly (on the 1st), with the CSV attached and a link to the Overview. Recipients are set on System, and changes are audited.
  - **Audit fixes:** total profiles excludes deleted users, logs today counts symptom and period logs, the Pro count is the same on every page, and retention is measured week by week per cohort.
- **#219, SMS campaigns** (spec #190): campaigns replace broadcasts. The 15-minute `sms-dispatch` cron sends them.
- **#223:** admin P0 security fixes #184–#189.
- **#224, admin-set Pro price** (spec #191): the Pro price is set in admin with a price history, and the daily subscription check is visible with its run history.
- **#222, #225:** test isolation guardrails (retro follow-ups).

**Migrations** (applied by `deploy.sh` after its backup):
- `20261101120000_sms_campaigns`: one-way. It copies `SmsBroadcast` rows into `SmsCampaign`/`SmsCampaignMessage`, then drops `SmsBroadcast`, `SmsBroadcastStatus` and `SmsSendLanguage`.
- `20261101130000_subscription_check_runs`, `20261101150000_pro_price`, `20261101160000_subscription_check_outcome_user_nullable`.
- `20261101170000_churn_events`, `20261101170000_user_activity`, `20261101170100_pro_snapshot`.
- `20261101180000_email_type_report`: adds `EmailType.REPORT`. Postgres can't drop an enum value, so this one is permanent.

**Post-deploy steps on the VPS (done 2026-11-01 ~06:30 Dhaka)**

1. `ADMIN_APP_URL=https://admin.cycle-circle.com` added to `/opt/vesta/.env.web.production` (backup `.env.web.production.bak-20261101-002824`). Then `docker compose --env-file ops/deploy/.env --env-file .env.monitoring.production -f ops/deploy/compose.prod.yml up -d --no-deps --force-recreate web`.
2. Crontab reinstalled from `ops/deploy/vesta-crontab` (backup `/opt/vesta/crontab.bak-20261101-002848`). It adds `sms-dispatch` (every 15 min), `pro-snapshot` (17:55 UTC = 23:55 Dhaka), and `reports` weekly (`0 3 * * 0`) and monthly (`0 3 1 * *`).

**Verification**

| Check | Result |
|---|---|
| `cycle-circle.com/login`, `admin.cycle-circle.com/login`, `/api/health/db` | 200 |
| `POST /api/auth/dev-login` | 403 |
| `POST /api/cron/pro-snapshot`, `/api/cron/reports` without the secret | 401 |
| `POST /api/cron/reports?kind=bogus` with the secret | 400 (auth passes, nothing sent) |
| `printenv ADMIN_APP_URL` in the web container | set |

**Data starts today:** active users, Pro snapshots and churn events have no history before this release. Past days on the Overview show as "unavailable", not zero, and the first Pro snapshot is taken 2026-11-01 23:55 Dhaka.

**Deploy:** `git push origin origin/main:production` → GitHub Actions *Production* workflow (run 41255956006).

---

## 2026-10-31 — Pregnancy mode removed, new tagline (PR #182)

**Shipped:** the pregnancy goal is gone. Goals are now tracking, conceive and perimenopause, and legacy `pregnancy`/`pregnant` values read as tracking. The tagline is now "Smarter Periods, Personalised Care." / "স্মার্ট পিরিয়ড, ব্যক্তিগত যত্ন।". Admin no longer says CaaS on the Subscriptions badge or the charge history.

**Migrations:** `20261025120000_remove_pregnancy_goal` (one-way data change).
- It moves pregnancy profiles to `tracking`.
- It re-enables all three alerts where pregnancy's all-off default was still set.
- Prod before deploy: 1 pregnancy profile, 3 tracking. Approved by the owner because there are no real users yet.

**Deploy:** `git push origin origin/main:production`.

---

## 2026-10-31 — E2E bug batch, delete past period, Bengali category names, bundled fonts (PRs #179, #180, #181)

**Shipped:**

- #179: follow-ups to the Bangladesh-day release (flaky tests fixed, admin user-detail dates in Bangladesh time).
- #180: 16 bugs found by the E2E suite (#134 #135 #137 #138 #139 #140 #141 #144 #145 #152 #153 #154 #157 #159 #166 #178).
  - **API:** a full profile list returns 409 `PROFILE_LIMIT_REACHED` (was 500), and a future period returns 400 `PERIOD_IN_FUTURE`.
  - **Admin:** every admin date renders in Bangladesh time.
  - **Admin `/sms`:** delivery counts show after Refresh data or the 5-min cache.
- #181: users can delete a past period from the Edit Period Log dialog (#136). Learn categories get an optional Bengali name (#156). Manrope and Noto Sans Bengali are bundled (`next/font/local`), so the build no longer fetches Google Fonts.

**Migrations:** `20261031120000_article_category_name_bn` (adds a nullable `ArticleCategory.nameBn`). Applied by `deploy.sh`.

**Deploy:** `git push origin origin/main:production` (6e4494a); the workflow deploy job succeeded.

**Found after deploy:** the magic-link callback redirected to `https://localhost:3000` because the route used `request.url` behind nginx. This hit the success path, which was broken before this release too, and the #140 error path. The fix is #183.

---

## 2026-10-30 — Bangladesh day everywhere, E2E suite (PRs #158, #177)

**Shipped** (spec #167, tickets #168–#176; fixes #115 #146 #147 #148 #151 #155 #160 #161):

- One "today" everywhere, the Bangladesh day (ADR 0008 amended, ADR 0009 new). Between 00:00 and 06:00 Bangladesh the dashboard, late-period alert, reminders, Check-in and symptoms page no longer use yesterday, and the dashboard and calendar hydrate.
- Admin per-day series group by the Bangladesh day; `days=N` returns exactly N buckets (was N+1 with an empty first one).
- Lint bans clock reads in shared server services and date-fns local-day functions; CI runs `test:tz` (Asia/Dhaka, America/New_York).
- The E2E suite (#158) ships with it; it changes no runtime behaviour beyond its listed fixes.

**Migrations:** none.

**Post-deploy data fix** (forward-only fix, past rows not backfilled; spec Out of Scope): one "All good" Check-in sentinel was saved at 2026-10-18 04:48 Bangladesh on the UTC day 2026-10-17 (#155). Moved to 2026-10-18 by id, in a transaction, after checking nothing else of that profile is on that day. The old bug also deleted real symptom logs of the previous day when "All good" was tapped in that window; that can't be recovered from the DB.

**Deploy:** merge #177, then `git push origin origin/main:production`. The workflow's deploy job failed (a transient Google Fonts fetch in the web build), then its rerun hit a GitHub `startup_failure` during a GitHub incident, so the same command was run over SSH: `cd /opt/vesta && bash ops/deploy/scripts/deploy.sh 0faeed3b18205c6531d71300ec5f6703b2022c5f`.

---

## 2026-10-25 — Auth tokens scoped per app and environment (PR #110)

**Effect:** every existing session (web and admin) is invalidated once on deploy, because old tokens carry no audience or issuer. Users log in again. See [ADR 0007](../adr/0007-auth-tokens-scoped-per-app-and-environment.md).

**Pre-deploy steps on the VPS** (done before the 2026-10-25 deploy; checked 2026-10-30: `APP_ENV` and `AUTH_COOKIE_NAME` set in both env files, the two `JWT_SECRET`s differ)

1. In both `/opt/vesta/.env.web.production` and `/opt/vesta/.env.admin.production` add `APP_ENV=production` (staging box: `APP_ENV=staging`).
2. Generate a new, distinct admin secret and put it in `.env.admin.production` as `JWT_SECRET`: `openssl rand -hex 32`. Web keeps its current `JWT_SECRET` (it must not start with `local-dev`). Do not reuse web's value.
3. Confirm `AUTH_COOKIE_NAME` is set in both files (`vesta_token` web, `vesta_admin_token` admin); the apps no longer start without it.
4. Check the two secrets differ: see the `diff` check in [04-env-reference.md](./04-env-reference.md).

**Post-deploy:** log in to web and to admin; expect to be asked once. A start-up error naming `JWT_SECRET`, `AUTH_COOKIE_NAME` or `APP_ENV` means step 1-3 was missed.

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
