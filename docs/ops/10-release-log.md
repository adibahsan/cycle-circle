# Release log

One entry per production release (`main` → `production`). Newest first. For the release mechanics see [03-deployment.md §5](./03-deployment.md#5-routine-deploy).

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

**Verification:** _filled in after the deploy._
