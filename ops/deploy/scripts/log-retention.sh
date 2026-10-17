#!/usr/bin/env bash
# Rotate and prune app logs (ADR 0004). Idempotent; safe to run daily.
#   - gzip every <channel>/YYYY-MM-DD.log dated before today (Asia/Dhaka)
#   - delete *.log.gz older than 400 days (translog) or 90 days (other channels)
# Age is taken from the date in the file name, not mtime.
# Run as root (container writes files as root): sudo crontab -e
#   15 0 * * * /opt/vesta/ops/deploy/scripts/log-retention.sh >> /var/log/vesta/log-retention.log 2>&1
set -euo pipefail

LOG_DIR="${LOG_DIR:-/var/log/vesta/app}"
TODAY="$(TZ=Asia/Dhaka date +%F)"

# Date N days before today (Asia/Dhaka) as YYYY-MM-DD; GNU date, BSD fallback.
days_ago() {
  TZ=Asia/Dhaka date -d "$TODAY -$1 days" +%F 2>/dev/null \
    || TZ=Asia/Dhaka date -v-"$1"d +%F
}

CUTOFF_TRANSLOG="$(days_ago 400)"
CUTOFF_OTHER="$(days_ago 90)"
zipped=0
deleted=0

if [[ -d "$LOG_DIR" ]]; then
  for dir in "$LOG_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    channel="$(basename "$dir")"
    cutoff="$CUTOFF_OTHER"
    [[ "$channel" == "translog" ]] && cutoff="$CUTOFF_TRANSLOG"

    for f in "$dir"????-??-??.log; do
      [[ -f "$f" ]] || continue
      day="$(basename "$f" .log)"
      if [[ "$day" < "$TODAY" ]]; then
        # Append so a pre-existing .gz is never clobbered (concatenated gzip is valid).
        gzip -c "$f" >> "$f.gz" && rm -f "$f"
        zipped=$((zipped + 1))
      fi
    done

    for f in "$dir"????-??-??.log.gz; do
      [[ -f "$f" ]] || continue
      day="$(basename "$f" .log.gz)"
      if [[ "$day" < "$cutoff" ]]; then
        rm -f "$f"
        deleted=$((deleted + 1))
      fi
    done
  done
fi

echo "$(date -u +%FT%TZ) log-retention dir=$LOG_DIR today=$TODAY gzipped=$zipped deleted=$deleted"
