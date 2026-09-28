# 06: Host crons and database backups

**Status:** ready-for-agent

**What to build:** Scheduled reminders, CAAS check, cert renewal, and nightly DB backups run on the VPS without manual intervention.

**Blocked by:** 05 (HTTPS URLs for cron targets)

- [ ] `/var/log/vesta` exists and is writable by `vesta`
- [ ] Crontab installed with real `CRON_SECRET` (not placeholder)
- [ ] `backup-db.sh` executable; manual run produces gzip under `/opt/vesta/backups`
- [ ] Documented verification: cron lines match UTC server clock (08:00 / 02:00 UTC jobs)
