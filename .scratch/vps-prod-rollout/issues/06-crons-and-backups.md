# 06: Host crons and database backups

**Status:** resolved

**What to build:** Scheduled reminders, CAAS check, cert renewal, and nightly DB backups run on the VPS without manual intervention.

**Blocked by:** 05 (HTTPS URLs for cron targets)

- [x] `/var/log/vesta` exists and is writable by `vesta`
- [x] Crontab installed with real `CRON_SECRET` (not placeholder) — `install-vesta-crontab.sh` (2026-09-29)
- [x] `backup-db.sh` executable; manual run produces gzip under `/opt/vesta/backups` (`vesta-20260929-063835.sql.gz`)
- [x] Documented verification: cron lines match UTC server clock (08:00 / 02:00 UTC jobs)

## Answer

Four jobs in `vesta` crontab: daily-reminders 08:00 UTC, caas-check 02:00 UTC, certbot renew 03:00/15:00 UTC, backup 04:00 UTC. Docker invocations use `sg docker` in script/crontab.
