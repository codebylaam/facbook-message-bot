#!/usr/bin/env bash
# Dumps the database in the custom format and prunes old dumps.
# Run from a systemd timer, or by hand: BACKUP_DIR=/var/backups/fb-bot ./scripts/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/fb-bot}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER="${CONTAINER:-fb-bot_postgres_1}"
DB_USER="${DB_USER:-fbbot}"
DB_NAME="${DB_NAME:-fbbot}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/fb-bot-$STAMP.dump"

podman exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner > "$TARGET"

# A dump that cannot be listed is not a dump.
podman exec -i "$CONTAINER" pg_restore --list < "$TARGET" > /dev/null

chmod 600 "$TARGET"
find "$BACKUP_DIR" -name 'fb-bot-*.dump' -type f -mtime +"$RETENTION_DAYS" -delete

echo "backup written: $TARGET"
