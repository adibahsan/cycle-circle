# Email Testing Guide — Vesta

All four email types can be verified end-to-end in about 10 minutes. This guide covers setup, triggering each email, confirming DB tracking, dedup prevention, and the admin panel.

---

## 1. Prerequisites

Start these before running any test.

### 1.1 Infrastructure (Docker)

```bash
just infra
```

Brings up PostgreSQL (port 5431), Redis (port 6379), and Mailpit (SMTP 1025, Web UI 8025).

Verify Mailpit is up:

```
http://localhost:8025
```

Expected: Mailpit inbox — empty at first.

### 1.2 Apps

Open two terminals:

```bash
just w   # web app on port 3000
just a   # admin app on port 3001
```

### 1.3 Confirm Dev Email Mode

In `apps/web/.env.local`, `RESEND_API_KEY` must be absent or empty. If it is set, all emails go to Resend (production), not Mailpit.

```bash
grep RESEND_API_KEY apps/web/.env.local
# Expected: no output, or RESEND_API_KEY=
```

When `RESEND_API_KEY` is absent, the adapter uses SMTP → `localhost:1025` → Mailpit.

### 1.4 Confirm Cron Secret

```bash
grep CRON_SECRET apps/web/.env.local
# Expected: CRON_SECRET=local-cron-secret-min-16
```

---

## 2. Testing Each Email Type

### 2.1 Magic Link Login

**What it does:** User enters email at login → receives a magic link via email.

**Steps:**

1. Open `http://localhost:3000/login`
2. Enter any registered email address (e.g., `bewej58391@nike4s.com`)
3. Select "Email" login method and submit

**Verify in Mailpit:**

```
http://localhost:8025
```

Expected: An email titled **"Your Vesta Login Link"** (or Bengali equivalent) appears within seconds. The email contains a one-time magic link.

**Rate limit:** 3 requests per hour per email address. If you trigger it a 4th time within 60 minutes, the API returns a rate-limit error — no email is sent and nothing is logged to `EmailLog`.

**DB check:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT type, status, provider, \"to\", \"sentAt\"::timestamp(0)
FROM \"EmailLog\"
WHERE type = 'MAGIC_LINK'
ORDER BY \"sentAt\" DESC
LIMIT 5;
"
```

Expected row: `type=MAGIC_LINK`, `status=SENT`, `provider=SMTP`.

---

### 2.2 Period Alert

**What it does:** Daily cron checks each profile for an upcoming period (within 0–2 days) and sends an alert.

**Step 1 — Set up the prediction to trigger:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
UPDATE \"Prediction\"
SET
  \"nextPeriodStart\" = CURRENT_DATE + INTERVAL '1 day',
  \"fertileStart\"    = CURRENT_DATE + INTERVAL '10 days',
  \"fertileEnd\"      = CURRENT_DATE + INTERVAL '16 days',
  \"ovulationDay\"    = CURRENT_DATE + INTERVAL '13 days'
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

This sets `nextPeriodStart` to tomorrow (within the 0–2 day window) while pushing `fertileStart` away from today to avoid triggering the fertile alert at the same time.

**Step 2 — Confirm notification pref is enabled:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT \"periodAlert\", \"fertileWindow\", \"loggingReminder\"
FROM \"NotificationPreference\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

If `periodAlert` is `false`, enable it:

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
UPDATE \"NotificationPreference\"
SET \"periodAlert\" = true
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

**Step 3 — Trigger the cron:**

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .
```

Expected response:

```json
{
  "processed": 1,
  "periodAlerts": 1,
  "fertileAlerts": 0,
  "reminders": 0,
  "errors": 0,
  "skipped": 0
}
```

**Verify in Mailpit:** Email titled **"Your period is coming"** (or Bengali) in the inbox.

---

### 2.3 Fertile Window Alert

**What it does:** Daily cron detects that today is the start of the fertile window.

**Step 1 — Set fertile window to start today, period away:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
UPDATE \"Prediction\"
SET
  \"fertileStart\"    = CURRENT_DATE,
  \"fertileEnd\"      = CURRENT_DATE + INTERVAL '6 days',
  \"ovulationDay\"    = CURRENT_DATE + INTERVAL '3 days',
  \"nextPeriodStart\" = CURRENT_DATE + INTERVAL '14 days'
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

**Step 2 — Confirm `fertileWindow` pref is enabled** (same query as above; update if needed).

**Step 3 — Clear today's EmailLog entries** (if you already ran the cron today, dedup will skip — reset first):

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
DELETE FROM \"EmailLog\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t'
  AND type IN ('PERIOD_ALERT', 'FERTILE_ALERT', 'LOGGING_REMINDER')
  AND \"sentAt\" > NOW() - INTERVAL '1 day';
"
```

**Step 4 — Trigger cron:**

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .
```

Expected: `"fertileAlerts": 1`

**Verify in Mailpit:** Email titled **"Your fertile window has started"** (or Bengali).

---

### 2.4 Logging Reminder

**What it does:** If the last period log is 3 or more days old (or never logged), a reminder is sent.

The test profile's last period log is already 10+ days old, so no date manipulation is needed.

**Step 1 — Confirm `loggingReminder` pref is enabled** (same query as above).

**Step 2 — Clear today's EmailLog** (same DELETE as above if needed).

**Step 3 — Set dates so period alert and fertile alert don't fire** (optional — keeps the response clean):

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
UPDATE \"Prediction\"
SET
  \"nextPeriodStart\" = CURRENT_DATE + INTERVAL '10 days',
  \"fertileStart\"    = CURRENT_DATE + INTERVAL '10 days',
  \"fertileEnd\"      = CURRENT_DATE + INTERVAL '16 days',
  \"ovulationDay\"    = CURRENT_DATE + INTERVAL '13 days'
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

**Step 4 — Trigger cron:**

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .
```

Expected: `"reminders": 1`

**Verify in Mailpit:** Email titled **"Don't forget to log"** (or Bengali).

---

### 2.5 All Three Notification Types in One Run

Set the prediction to hit all three conditions simultaneously:

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
UPDATE \"Prediction\"
SET
  \"nextPeriodStart\" = CURRENT_DATE + INTERVAL '1 day',
  \"fertileStart\"    = CURRENT_DATE,
  \"fertileEnd\"      = CURRENT_DATE + INTERVAL '6 days',
  \"ovulationDay\"    = CURRENT_DATE + INTERVAL '3 days'
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

Then clear today's logs and trigger the cron. Expected response:

```json
{
  "processed": 1,
  "periodAlerts": 1,
  "fertileAlerts": 1,
  "reminders": 1,
  "errors": 0,
  "skipped": 0
}
```

Three emails appear in Mailpit.

---

## 3. Verifying DB Tracking

### Full log view:

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT type, status, provider, \"to\", \"deliveryStatus\", \"sentAt\"::timestamp(0)
FROM \"EmailLog\"
ORDER BY \"sentAt\" DESC
LIMIT 20;
"
```

### Filter by type:

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT id, type, status, \"to\", error, \"sentAt\"::timestamp(0)
FROM \"EmailLog\"
WHERE type = 'PERIOD_ALERT'
ORDER BY \"sentAt\" DESC;
"
```

### Via Prisma Studio (GUI):

```bash
just studio
```

Navigate to the `EmailLog` table. Columns to check:

| Column | Expected value (dev) |
|--------|----------------------|
| `status` | `SENT` |
| `provider` | `SMTP` |
| `deliveryStatus` | `PENDING` (Resend webhooks don't fire in dev) |
| `error` | null |
| `resendId` | null (SMTP sends don't generate a Resend ID) |

---

## 4. Testing Dedup Prevention

The `wasEmailSentToday()` function prevents the same email type from being sent twice to the same profile on the same day.

**Step 1 — Trigger the cron once** (ensures at least one email is sent):

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .
# Expected: at least one of periodAlerts/fertileAlerts/reminders is > 0
```

**Step 2 — Trigger the cron a second time immediately:**

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .
```

Expected response (all sends become skips):

```json
{
  "processed": 1,
  "periodAlerts": 0,
  "fertileAlerts": 0,
  "reminders": 0,
  "errors": 0,
  "skipped": 3
}
```

No new emails appear in Mailpit. No new rows added to `EmailLog`.

**Step 3 — Confirm EmailLog count didn't change:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT COUNT(*) FROM \"EmailLog\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t'
  AND \"sentAt\" > NOW() - INTERVAL '1 hour';
"
```

Count should be the same before and after the second cron call.

---

## 5. Admin Panel Walkthrough

### 5.1 Login

```
http://localhost:3001/login
```

Email: `admin@vesta.health`  
Password: `admin123`

### 5.2 Email Logs Page

```
http://localhost:3001/emails
```

Shows all `EmailLog` entries in a paginated table. Available filters:

- **Type**: MAGIC_LINK / PERIOD_ALERT / FERTILE_ALERT / LOGGING_REMINDER
- **Status**: SENT / FAILED
- **Delivery status**: PENDING / DELIVERED / BOUNCED / COMPLAINED / DELAYED
- **Search**: by recipient email address

After running the cron, verify each email type appears here with correct status.

### 5.3 Email Preview Page

```
http://localhost:3001/emails/preview
```

Renders each template with sample data. Use the EN/BN toggle to verify both languages render correctly. No email is actually sent from this page — it is render-only.

Templates to verify:

| Template | What to check |
|----------|---------------|
| Magic Link | Link is present, language switches correctly |
| Period Alert | Date is formatted correctly in both languages |
| Fertile Window | Date range shows correctly |
| Logging Reminder | Days-since count shows correctly |

---

## 6. Troubleshooting

### No email in Mailpit after cron

**Check 1 — Cron returned errors:**

```bash
curl -s -X POST http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer local-cron-secret-min-16" \
  | jq .errors
```

If `errors > 0`, check the web app terminal for stack traces.

**Check 2 — Dedup already fired today:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT type, \"sentAt\"::timestamp(0) FROM \"EmailLog\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t'
  AND DATE(\"sentAt\") = CURRENT_DATE;
"
```

If rows exist, run the DELETE from section 2.3 to clear them.

**Check 3 — Prediction dates don't match conditions:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT \"nextPeriodStart\", \"fertileStart\", CURRENT_DATE AS today
FROM \"Prediction\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

Conditions that trigger each type:

| Type | Condition |
|------|-----------|
| Period Alert | `nextPeriodStart` is today, tomorrow, or day after |
| Fertile Window | `fertileStart` = today exactly |
| Logging Reminder | Last `PeriodLog` is 3+ days old, or none exists |

**Check 4 — Notification prefs are off:**

```bash
docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev -c "
SELECT * FROM \"NotificationPreference\"
WHERE \"profileId\" = 'cmpshs8pr0004gslgvbld847t';
"
```

All three columns should be `t` (true).

### 401 Unauthorized from cron endpoint

The `Authorization` header value must match `CRON_SECRET` exactly (including case).

```bash
grep CRON_SECRET apps/web/.env.local
```

Use that exact value in the curl command.

### Mailpit not reachable

```bash
docker ps | grep mailpit
```

If no container is running, restart infra:

```bash
just infra
```

### Emails going to Resend instead of Mailpit

```bash
grep RESEND_API_KEY apps/web/.env.local
```

If a key is set, comment it out and restart the web app (`just w`).

### `jq: command not found`

Remove `| jq .` from the curl commands and read raw JSON output instead.

---

## 7. Quick Reference

| Task | Command / URL |
|------|---------------|
| Start infra | `just infra` |
| Start web app | `just w` |
| Start admin app | `just a` |
| Mailpit inbox | `http://localhost:8025` |
| Web app | `http://localhost:3000` |
| Admin panel | `http://localhost:3001` |
| Admin login | `admin@vesta.health` / `admin123` |
| Email logs (admin) | `http://localhost:3001/emails` |
| Email preview (admin) | `http://localhost:3001/emails/preview` |
| Trigger cron | `curl -s -X POST http://localhost:3000/api/cron/daily-reminders -H "Authorization: Bearer local-cron-secret-min-16" \| jq .` |
| Prisma Studio | `just studio` |
| DB direct access | `docker exec -i $(docker ps -q -f ancestor=postgres:16-alpine) psql -U vesta -d vesta_dev` |
| Clear today's logs | `DELETE FROM "EmailLog" WHERE "profileId" = 'cmpshs8pr0004gslgvbld847t' AND type IN ('PERIOD_ALERT','FERTILE_ALERT','LOGGING_REMINDER') AND "sentAt" > NOW() - INTERVAL '1 day'` |

### Key Source Files

| File | Purpose |
|------|---------|
| `packages/shared/src/server/adapters/mail.ts` | Transport layer — Resend vs SMTP, DB logging |
| `packages/shared/src/server/adapters/notifications.ts` | Period / fertile / logging notification senders |
| `packages/shared/src/server/email-templates.ts` | HTML templates (bilingual) |
| `packages/shared/src/server/services/email-service.ts` | DB queries — list, stats, dedup check, webhook update |
| `apps/web/src/app/api/cron/daily-reminders/route.ts` | Cron handler with dedup logic |
| `apps/web/src/app/api/webhooks/resend/route.ts` | Resend delivery webhook handler |
| `apps/admin/src/app/(admin)/emails/` | Admin email logs + preview pages |
| `ops/docker/compose.yml` | Mailpit service definition |

### EmailLog `status` vs `deliveryStatus`

| Field | Set by | Values | Dev behavior |
|-------|--------|--------|--------------|
| `status` | Mail adapter at send time | `SENT` / `FAILED` | Always populated |
| `deliveryStatus` | Resend webhook (`/api/webhooks/resend`) | `PENDING` / `DELIVERED` / `BOUNCED` / `COMPLAINED` / `DELAYED` | Stays `PENDING` — Resend webhook is not called against dev SMTP |
