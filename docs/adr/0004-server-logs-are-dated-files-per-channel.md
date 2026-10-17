# Server logs are dated JSON-line files, one directory per log channel

Every server log line belongs to one of six log channels (merchant, customer, webhook, translog, cron, error; see GLOSSARY.md) and is appended asynchronously to `<LOG_DIR>/<channel>/YYYY-MM-DD.log` as one JSON object, and mirrored to stdout. On the VPS `LOG_DIR` is the host directory `/var/log/vesta/app`, bind-mounted into web, admin and worker; locally it is `./logs`. We chose this because Docker keeps only 3 × 10 MB of stdout per container, which loses the BDApps masked ids and plan-change history within days, and because the app now runs only on our own server (no Vercel), so files persist.

## Considered Options

- **pino + pino-roll / winston + daily-rotate-file**: rejected for now; worker-thread transports need Next.js bundling exceptions, and our volume is low. A ~100-line in-house writer has no dependencies.
- **Rotation by file name, not by size**: the file name carries the Asia/Dhaka date, so a new file starts at Bangladesh midnight with no rotation step. A host script gzips past days and deletes them after 400 days (translog, the plan-change audit trail) or 90 days (all other channels).

## Consequences

- Lines are written in full (phones, masked ids, OTPs) except credentials: the BDApps password, JWTs, cookies and the Authorization header are always `<REDACTED>`. Log files are therefore sensitive and stay on the server.
- Writes never fail a request: on a write error the line goes to stderr. Open files are flushed on SIGTERM so a deploy does not lose the last lines.
- A `requestId` on every line links one request across channels (customer action → merchant call → translog).
