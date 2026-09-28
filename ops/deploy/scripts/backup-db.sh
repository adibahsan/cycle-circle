#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/opt/vesta/backups
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/vesta-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

cd /opt/vesta
docker compose -f ops/deploy/compose.prod.yml exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain --no-acl --no-owner' | gzip > "$FILE"

find "$BACKUP_DIR" -name 'vesta-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
