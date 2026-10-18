# Application Logging

Server logs are dated JSON-line files per channel (see [ADR 0004](../adr/0004-server-logs-are-dated-files-per-channel.md)). Docker's own `json-file` logs keep only 3 x 10 MB per container, so the files below are the durable record.

> **Sensitive.** Log files contain phone numbers, OTPs and masked subscriber ids. Keep them on the VPS, never paste them into tickets or chat, and do not copy them off the host without need.

## Channels

| Channel | What it records |
|---|---|
| `merchant` | Calls Cycle Circle makes out to BDApps (OTP, subscription status, subscribe/unsubscribe, SMS, CaaS), with request and response |
| `customer` | End-user actions: login, OTP request/verify, add phone, unsubscribe, logout |
| `webhook` | Calls BDApps makes into Cycle Circle (subscription notifications, incoming SMS/USSD, delivery reports) and what we did |
| `translog` | One record per plan change (Free/Pro, admin override, charge): who, from, to, cause |
| `cron` | One summary per scheduled-job run, plus per-item failures |
| `error` | Unhandled and handled server errors |

## File layout and rotation

```
/var/log/vesta/app/<channel>/YYYY-MM-DD.log      # today, JSON lines
/var/log/vesta/app/<channel>/YYYY-MM-DD.log.gz   # past days, compressed
```

- The date in the file name is the **Asia/Dhaka** date, independent of the host timezone.
- A new file starts at Dhaka midnight (the app just writes to the file for the current date).
- `ops/deploy/scripts/log-retention.sh` gzips every past day's file and prunes by the date in the file name.

## Retention

| Channel | Kept for |
|---|---|
| `translog` | 400 days |
| all others | 90 days |

## One-time server setup

`web` and `admin` containers run as root (no `USER` in the Dockerfiles), so they can write to the bind mount regardless of owner. Own the directory by the `vesta` host user (uid 1001, gid 1001) so you can read it over ssh:

```bash
ssh vesta
sudo install -d -m 0750 -o 1001 -g 1001 /var/log/vesta/app
```

Then redeploy so `compose.prod.yml` mounts it (`LOG_DIR=/var/log/vesta/app` is set there for `web` and `admin`).

Files and channel dirs are created by the containers as root (0755/0644), which `vesta` can read but not delete, so run retention from **root's** crontab:

```bash
sudo crontab -e
# add:
15 0 * * * /opt/vesta/ops/deploy/scripts/log-retention.sh >> /var/log/vesta/log-retention.log 2>&1
```

Timezone caveat: cron uses the **host** timezone, which is currently Europe/Berlin (the UTC decision is pending, see [02-server-setup.md](./02-server-setup.md#timezone)). `00:15` therefore means 00:15 Berlin, not Dhaka. This is harmless: the script computes "today" with `TZ=Asia/Dhaka` itself and never touches the current Dhaka day's file. Any time after Dhaka midnight works; under Berlin or UTC the script may run a few hours after rollover.

The script is idempotent and prints one summary line (`gzipped=N deleted=M`).

## Reading logs

```bash
# from the admin Mac
just logs-prod                      # today's error channel (tail -f)
just logs-prod merchant             # another channel
just logs-prod cron 2026-10-17      # a specific Dhaka date

# on the server
ssh vesta
tail -n 200 -f /var/log/vesta/app/customer/$(TZ=Asia/Dhaka date +%F).log
jq 'select(.event=="subscription/otp/verify")' /var/log/vesta/app/customer/$(TZ=Asia/Dhaka date +%F).log
zcat /var/log/vesta/app/translog/2026-10-01.log.gz | jq .
zcat /var/log/vesta/app/merchant/2026-10-0*.log.gz | jq 'select(.level=="error")'
```

## Admin Logs page

The admin app has a read-only **Logs** page (`/logs`, Super Admin only) over the same files: filter by channel, Dhaka date range, text, request id and user id, open any line's raw payload, and page back through older lines. It reads plain `.log` and past-day `.log.gz` files from `LOG_DIR`, so the `admin` container needs the same bind mount as `web` (already set in `compose.prod.yml`; the admin container only reads). OTP values are masked at read time; the files on disk are unchanged.

## Environment

`LOG_DIR` and `LOG_STDOUT` are documented in [04-env-reference.md](./04-env-reference.md#logging).
