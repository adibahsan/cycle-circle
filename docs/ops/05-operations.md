# Day-2 Operations

Logs, backups, restarts, updates, crons, and incident response for the running Vesta
stack. Assumes [02-server-setup.md](./02-server-setup.md) and
[03-deployment.md](./03-deployment.md) are done — the app is deployed in `/opt/vesta`
via Docker Compose (nginx, web, admin, postgres, redis). Env var names are defined in
[04-env-reference.md](./04-env-reference.md).

> **Convention:** every `docker compose …` command below is run from `/opt/vesta` with
> `COMPOSE_FILE` pointing at the prod compose file (set once for `vesta`, see
> [03-deployment.md §4](./03-deployment.md#4-first-deploy-runbook)):
>
> ```bash
> echo 'export COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml' >> ~/.bashrc && source ~/.bashrc
> ```
>
> Without it, plain `docker compose` looks for `compose.yml` in the current directory and
> fails (or, in the repo root, picks up nothing). Equivalent one-off form:
> `docker compose -f ops/deploy/compose.prod.yml <cmd>`.

---

## 1. Quick health check

```bash
ssh vesta
cd /opt/vesta

docker compose ps                                    # all services "Up" / healthy
curl -fsS https://cycle-circle.com/api/health/db      # {"status":"ok","latency":N}

df -h /                                               # disk
free -h                                               # memory
docker system df                                      # image/container/volume disk usage
```

**Monitoring (Prometheus + Grafana):** bundled in prod Compose ([ops/monitoring/README.md](../../ops/monitoring/README.md)). Grafana is served at `https://monitoring.cycle-circle.com` (nginx only — Prometheus has **no** public vhost). Enable the monitoring hostname only after [host hardening](https://github.com/adibahsan/cycle-circle/issues/12). TSDB retention is **30 days** — watch root disk (`df -h /`) as metrics grow. Rotate `GRAFANA_ADMIN_PASSWORD` via `/opt/vesta/.env.monitoring.production`. Verify scrape targets in Grafana or Prometheus (internal network / SSH port-forward to `:9090` for emergencies).

**Complementary (not replaced by Grafana):** **Sentry** for application errors and **UptimeRobot** (or similar) for external HTTP uptime on public health URLs — align with [DEPLOYMENT-PLAN.md](../../DEPLOYMENT-PLAN.md) post-launch monitoring.

`/api/health/db` is the **only prod-meaningful health route** — it's a real DB
round-trip. `/api/health/redis`, `/api/health/bdapps`, `/api/health/mailpit`,
`/api/health/worker` exist in the app but are dev/staging-oriented (mailpit doesn't
run in prod at all; see `apps/web/src/app/api/health/*`) — a 503 from one of those
isn't necessarily an incident on its own, cross-check with the specific service's
logs (§2) before treating it as one.

A non-"ok" `/api/health/db` response or a container not `Up` → go to
[§7 Incident checklist](#7-incident-checklist).

---

## 2. Logs

> **App logs** (merchant, customer, webhook, translog, cron, error) are files under `/var/log/vesta/app/<channel>/<YYYY-MM-DD>.log`, Dhaka date. See [08-logging.md](./08-logging.md); `just logs-prod <channel>` tails today's file. Container stdout (below) keeps only 3 × 10 MB.

### Container logs

```bash
cd /opt/vesta
docker compose logs -f web                # web app (Next.js)
docker compose logs -f admin              # admin app
docker compose logs -f nginx              # reverse proxy / TLS
docker compose logs -f postgres           # database

docker compose logs --since 1h web        # bounded, non-following
docker compose logs --tail 200 web        # last N lines
```

### System logs

```bash
journalctl -u docker -f                   # Docker daemon
journalctl -u ssh -f                      # SSH auth attempts (also feeds fail2ban)
journalctl -u fail2ban -f                 # ban/unban activity, once §6 of 02-server-setup.md is applied
```

### Webhook debugging (nginx access log, `X-Real-IP`)

BDApps webhook auth (`BDAPPS_WEBHOOK_IPS`) checks the `x-real-ip` header
(`packages/shared/src/server/adapters/webhooks.ts`), which nginx must set from the
real client IP before proxying to `web`. To see what IP a webhook call actually
arrived from:

```bash
docker compose logs nginx | grep -i webhook
docker compose logs nginx | grep 'x_real_ip\|X-Real-IP'
```

If the nginx access log format in [03-deployment.md](./03-deployment.md) doesn't
already include `$http_x_real_ip` / `$remote_addr`, add it there — you need it to
diagnose a `401` from `/api/webhooks/*` (§7).

---

## 3. Restart / stop / start services

```bash
cd /opt/vesta

docker compose restart web                # one service, keeps others running
docker compose restart web admin          # a subset
docker compose up -d                      # start anything stopped, recreate changed services
docker compose stop                       # stop all, containers remain (fast restart)
docker compose down                       # stop + remove containers (volumes kept)
```

Never run `docker compose down -v` in production — it removes volumes, including the
postgres data volume, unless you are deliberately wiping the stack after a verified
backup.

### Reboot the VPS

```bash
sudo reboot
```

What comes back automatically: every service in the compose file has
`restart: unless-stopped`, so Docker restarts them all when the `docker` daemon
starts on boot — no manual `docker compose up` needed after a reboot. Verify anyway:

```bash
ssh vesta
docker compose -f /opt/vesta/*.yml ps 2>/dev/null || (cd /opt/vesta && docker compose ps)
curl -fsS https://cycle-circle.com/api/health/db
```

Check for a pending reboot before scheduling one:
`test -f /var/run/reboot-required` (see
[02-server-setup.md §5](./02-server-setup.md#5-unattended-upgrades-and-reboot-policy)
— auto-reboot is intentionally **off**, so this only happens when you run it).

---

## 4. Postgres backups

### Nightly automated backup (host cron → gzip, 14-day retention)

Repo precedent: `just db-backup-url <url>` (in the repo root `justfile`) does an
ad-hoc `pg_dump --format=plain --no-acl --no-owner` to `ops/backups/` — useful for a
one-off manual dump against any connection string, but it doesn't gzip or rotate, and
`ops/backups/` is gitignored on purpose (real data). The **production nightly job**
below follows the same `pg_dump` shape but runs from host cron, gzips, and prunes.

Create `/opt/vesta/backup-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/opt/vesta/backups
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/vesta-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

cd /opt/vesta
docker compose exec -T postgres pg_dump -U vesta_user -d vesta_prod \
  --format=plain --no-acl --no-owner | gzip > "$FILE"

# prune anything older than retention
find "$BACKUP_DIR" -name 'vesta-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
```

(Adjust `-U`/`-d` to match the actual `POSTGRES_USER` / `POSTGRES_DB` set in
[03-deployment.md](./03-deployment.md)'s compose file / env — same pattern as the
dev compose in `ops/docker/compose.yml`.)

```bash
chmod +x /opt/vesta/backup-db.sh
crontab -e
# 0 3 * * *  /opt/vesta/backup-db.sh >> /opt/vesta/backups/backup.log 2>&1
```

Pick the cron time deliberately relative to the server's timezone (see
[02-server-setup.md §1](./02-server-setup.md#1-base-packages-locale-timezone)) —
`0 3 * * *` is 03:00 in whatever timezone the server clock is set to.

### Article images (uploads directory)

Images the Super Admin uploads into articles live on the host at
`/var/lib/vesta/uploads` (bind-mounted into `admin` read-write and `web` read-only as
`UPLOAD_DIR`). They are **not** in Postgres, so a DB dump does not cover them.
`ops/deploy/scripts/backup-db.sh` also writes `uploads-<timestamp>.tar.gz` next to each
dump (same 14-day retention), so the off-box copy below picks them up too. To restore:
`tar -xzf uploads-<timestamp>.tar.gz -C /var/lib/vesta/uploads`.

One-time host setup (before the first deploy that includes this change):

```bash
sudo mkdir -p /var/lib/vesta/uploads
```

If the apps' container user is not root, `chown` the directory to that user so `admin` can write.

### Off-box copy (required — backups on the same disk as the DB don't survive a
disk failure)

Contabo Object Storage is available in the panel. Sync after each backup, or on its
own schedule:

```bash
# example with rclone (configure a remote named `contabo-backups` once, interactively)
rclone sync /opt/vesta/backups contabo-backups:vesta-backups --min-age 5m

# or a simple scp to the admin Mac / another host, if object storage isn't set up yet
scp /opt/vesta/backups/vesta-*.sql.gz youradmin@yourmac:/path/to/backup/archive/
```

Add whichever command to the same crontab, right after the backup job, or as its own
entry a few minutes later (`--min-age 5m` above avoids racing an in-progress dump).

### Restore procedure

**Always restore to a scratch database first** — never `psql` a backup straight into
the live `vesta_prod` database.

```bash
cd /opt/vesta

# 1. create a scratch DB inside the same postgres container
docker compose exec -T postgres psql -U vesta_user -d postgres \
  -c "CREATE DATABASE vesta_restore_check;"

# 2. restore the gzipped dump into it
gunzip -c /opt/vesta/backups/vesta-<timestamp>.sql.gz | \
  docker compose exec -T postgres psql -U vesta_user -d vesta_restore_check

# 3. sanity-check row counts / spot-check a few tables
docker compose exec -T postgres psql -U vesta_user -d vesta_restore_check \
  -c "SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"PeriodLog\";"

# 4. only once satisfied — drop the scratch DB
docker compose exec -T postgres psql -U vesta_user -d postgres \
  -c "DROP DATABASE vesta_restore_check;"
```

**Restoring over the real database** (disaster recovery only — this destroys
current data, confirm you have a fresh pre-restore backup of the live DB first):

```bash
# stop app containers so nothing writes during the restore
docker compose stop web admin

docker compose exec -T postgres psql -U vesta_user -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vesta_prod' AND pid <> pg_backend_pid();"
docker compose exec -T postgres psql -U vesta_user -d postgres -c "DROP DATABASE vesta_prod;"
docker compose exec -T postgres psql -U vesta_user -d postgres -c "CREATE DATABASE vesta_prod;"
gunzip -c /opt/vesta/backups/vesta-<timestamp>.sql.gz | \
  docker compose exec -T postgres psql -U vesta_user -d vesta_prod

docker compose up -d web admin
curl -fsS https://cycle-circle.com/api/health/db
```

---

## 5. Updates

### OS patching

Security updates install automatically (`unattended-upgrades`, see
[02-server-setup.md §5](./02-server-setup.md#5-unattended-upgrades-and-reboot-policy)).
For everything else:

```bash
sudo apt update && sudo apt -y upgrade
test -f /var/run/reboot-required && echo "reboot needed" || echo "no reboot needed"
```

### Docker image updates (app releases)

Handled by the deploy flow in [03-deployment.md](./03-deployment.md) — pull/build
the new image, `docker compose up -d --build <service>`. For third-party images
(nginx, postgres, redis) pinned by tag in the compose file, bump the tag
deliberately (don't float `:latest` in prod) and redeploy:

```bash
cd /opt/vesta
docker compose pull nginx redis          # or whichever service's tag you bumped
docker compose up -d nginx redis
docker system prune -f                   # reclaim space from old image layers, after confirming the new ones are healthy
```

### Postgres minor version upgrades

Same-major-version image tag bumps (e.g. `postgres:17.9` → `postgres:17.10`) are
safe to apply like any other image update — take a backup first (§4), then:

```bash
cd /opt/vesta
docker compose pull postgres
docker compose up -d postgres
docker compose exec -T postgres pg_isready -U vesta_user -d vesta_prod
```

> **Major version upgrades (e.g. 17 → 18) are not a simple image bump.** Postgres
> major versions have on-disk format changes — swapping the image tag against the
> existing data volume will fail to start or corrupt data. A major upgrade needs
> `pg_dump`/`pg_restore` into a fresh volume (or `pg_upgrade` between two running
> containers), planned as its own maintenance window with a tested rollback, not a
> routine update. Take a full backup (§4) and a Contabo snapshot (§8) before
> attempting one.

---

## 6. Crons

Production scheduling is **host crontab**, not Vercel Cron and not the local-dev
BullMQ `worker` container — the host hits the app's cron routes directly over HTTPS
on a schedule:

```bash
crontab -l   # view current schedule
crontab -e   # edit
```

Example entries (adjust times for the server's timezone — see
[02-server-setup.md §1](./02-server-setup.md#1-base-packages-locale-timezone)).
Create the log directory once first: `mkdir -p /opt/vesta/logs`.

```cron
# daily reminders — historically run at 08:00 UTC (it also runs the SMS dispatch step once)
0 8 * * * curl -fsS -X GET https://cycle-circle.com/api/cron/daily-reminders \
  -H "Authorization: Bearer $CRON_SECRET" >> /opt/vesta/logs/cron-reminders.log 2>&1

# SMS campaign dispatch — EVERY 15 MINUTES. Sends today's campaign message once the daily send
# time (admin System page, Bangladesh time) has passed; marks missed days. Sends no reminder
# emails and is safe to repeat. Without this line the message goes out only at the 08:00 UTC
# daily-reminders run, whatever send time is set.
*/15 * * * * curl -fsS -X POST https://cycle-circle.com/api/cron/sms-dispatch \
  -H "Authorization: Bearer $CRON_SECRET" >> /opt/vesta/logs/cron-sms-dispatch.log 2>&1

# Daily subscription check (BDApps subscriber-status: downgrades UNREGISTERED, restores re-subscribed)
# + Supabase-era keep-alive query — historically run at 02:00 UTC. Route slug stays `caas-check`.
0 2 * * * curl -fsS -X GET https://cycle-circle.com/api/cron/caas-check \
  -H "Authorization: Bearer $CRON_SECRET" >> /opt/vesta/logs/cron-caas.log 2>&1

# nightly admin maintenance (MAE snapshot + purge of accounts deleted >30 days ago) — 02:30 UTC
30 2 * * * curl -fsS -X POST https://cycle-circle.com/api/cron/nightly-maintenance \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/vesta/cron-nightly-maintenance.log 2>&1

# Pro subscriber snapshot — 17:55 UTC = 23:55 Bangladesh time. Stores one Pro count per Bangladesh
# day (ProSnapshot); churn rate and estimated revenue read it. A missed night leaves a gap, never a guess.
55 17 * * * curl -fsS -X POST https://cycle-circle.com/api/cron/pro-snapshot \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/vesta/cron-pro-snapshot.log 2>&1
```

**Human step: the VPS crontab is not changed by deploying this code.** Someone with SSH
must add the `*/15 * * * *` `sms-dispatch` line above (the repo copy is
`ops/deploy/vesta-crontab`; reinstall it as in the deployment doc, or `crontab -e`).
Until then the daily send time only takes effect at the existing 08:00 UTC run (14:00
Bangladesh time, the default send time); a send time earlier than that is sent at 14:00,
and a message never goes out on a day whose run it missed.

The daily send time is set on the admin **/system** page (Bangladesh time, UTC+6, no DST;
default 14:00). Dispatch is idempotent: calling `sms-dispatch` (or `daily-reminders`) any
number of times a day sends each message once. A planned message whose day passed unsent is
marked **Missed** and never sent late. `sms-dispatch` honours the same on/off switch as
`daily-reminders`.

`$CRON_SECRET` isn't available inside a plain crontab line by default — either
`source` an env file first (`. /opt/vesta/.env.production && curl ...`) or hardcode
the value in the crontab entry itself (root's crontab, mode 600, is not
world-readable — acceptable, but never put the value in this repo). Full env var
reference: [04-env-reference.md](./04-env-reference.md).

Both routes 401 if the header is missing or wrong — there's no "unset = allow" path
(`withCronAuth`, `packages/shared/src/server/middleware.ts`). Each route also checks
a DB-backed on/off toggle (`CronSetting` table) *after* auth passes — a disabled cron
returns `200 {"skipped":true,"reason":"cron disabled"}` and does no work, toggled
from the admin **/system** page.

### Checking a cron ran

```bash
tail -50 /opt/vesta/logs/cron-reminders.log
tail -50 /opt/vesta/logs/cron-caas.log
grep CRON /var/log/syslog   # or: journalctl | grep -i cron  — confirms crond fired the job at all
```

A healthy run's JSON response includes counts (`{"checked":N,"downgraded":N,"skipped":N,"errors":N,"reinstated":N}` for
`caas-check`, the daily subscription check; reminder counts + `smsBroadcast` for `daily-reminders`; `smsBroadcast` + `smsRecovery` for `sms-dispatch`) — an empty
`curl` output or a non-200 means the trigger itself failed, not just "nothing to do".

### Triggering manually

```bash
curl -s -X POST https://cycle-circle.com/api/cron/daily-reminders \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool

curl -s -X POST https://cycle-circle.com/api/cron/caas-check \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool

# returns {"snapshotTiers":2,"purged":N,"failed":N}; each purge is a translog `account.purge` line
curl -s -X POST https://cycle-circle.com/api/cron/nightly-maintenance \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool
```

`POST` (vs. the crontab's `GET`) accepts a JSON body — `{"overrideDisabled": true}`
forces a run past the admin on/off toggle; `daily-reminders` also accepts
`{"userId": "...", "force": true}` to re-trigger one user's reminders.

---

## 7. Incident checklist

### Site down / no response

```bash
ssh vesta
cd /opt/vesta
docker compose ps                          # anything not "Up"?
docker compose logs --tail 100 nginx
docker compose logs --tail 100 web
curl -fsS https://cycle-circle.com/api/health/db
```

Restart the unhealthy service first (§3) before anything more invasive.

### 502 from nginx

Means nginx is up but can't reach `web`/`admin` upstream.

```bash
docker compose ps web admin                # are they "Up"? did they just restart-loop?
docker compose logs --tail 200 web
docker compose logs --tail 200 admin
```

Common causes: app container crashed on a bad env var or failed DB connection at
boot (check the crash log directly above), or the app is still starting (cold start
after a deploy — give it a few seconds and recheck `docker compose ps`).

### DB disk full

```bash
df -h /
docker system df -v                        # is it Docker images/logs, or the postgres volume itself?
docker compose exec -T postgres psql -U vesta_user -d vesta_prod \
  -c "SELECT pg_size_pretty(pg_database_size('vesta_prod'));"
```

Quick relief: `docker system prune -f` (safe — only removes unused images/build
cache, not volumes) and check `/opt/vesta/backups` isn't accumulating past its
retention (§4's `find -mtime +14 -delete` should be handling this — verify it's
actually running via `backup.log`). If the postgres volume itself is the growth,
that's a capacity/retention problem, not a quick fix — check for runaway tables or
missing vacuum before resizing the disk.

### Webhook `401`s (BDApps)

```bash
docker compose logs nginx | grep -i webhook   # confirm what IP the call arrived from (§2)
```

`BDAPPS_WEBHOOK_IPS` is a comma-separated allowlist checked against the `x-real-ip`
header (`packages/shared/src/server/adapters/webhooks.ts`) — a `401` means either the
calling IP isn't in that list (BDApps rotated/added an egress IP — update the env
var, see [04-env-reference.md](./04-env-reference.md)) or nginx isn't setting
`x-real-ip` correctly (check the proxy config in
[03-deployment.md](./03-deployment.md)). If `BDAPPS_WEBHOOK_IPS` is unset entirely,
the check is skipped (dev-only behavior) — it must be set in production.

### Certificate expiry

```bash
echo | openssl s_client -connect cycle-circle.com:443 -servername cycle-circle.com 2>/dev/null | openssl x509 -noout -dates
sudo certbot certificates              # once certbot is installed per 03-deployment.md
sudo certbot renew --dry-run           # test renewal without changing the live cert
sudo certbot renew                     # actual renewal
```

Certbot's own systemd timer normally handles renewal automatically — this is for
diagnosing why it didn't, or for forcing one ahead of a known expiry.

### Locked out (SSH/server access)

Not an app incident — go straight to
[01-access.md § Lockout recovery decision tree](./01-access.md#5-lockout-recovery-decision-tree).

---

## 8. Snapshots before risky changes

Contabo panel → instance `vmi3612692` → **Snapshots** tab. Take one before:

- Postgres major version upgrades (§5)
- The SSH hardening runbook ([02-server-setup.md §6](./02-server-setup.md#6-hardening-runbook))
- Any `docker compose down -v` / volume-destructive operation
- OS-level changes you're not fully sure about (kernel upgrades, disk resizing)

Contabo's **Auto Backup** add-on is **not enabled** on this instance — snapshots are
manual only, and restoring one is a full-instance rollback (not a granular DB
restore — use §4 for that). Don't rely on snapshots as your database backup
strategy; they're a safety net for the whole VM, taken deliberately before a
specific risky operation, not a schedule.
