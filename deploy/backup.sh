#!/usr/bin/env bash
# Backs up the shop database: pg_dump from the db container, gzipped, into /opt/shop/backups.
# Keeps the newest 14. Runs every night at 01:30 IST (deploy/systemd/shop-backup.timer).
# By hand: sudo /opt/shop/app/deploy/backup.sh
set -euo pipefail
COMPOSE="docker compose -f /opt/shop/app/deploy/docker-compose.yml"
DIR=/opt/shop/backups
KEEP=14

umask 077
mkdir -p "$DIR"; chmod 700 "$DIR"
name="shop-$(date -u +%Y%m%d-%H%M%S).sql.gz"
tmp="$DIR/.$name.partial"
trap 'rm -f "$tmp"' EXIT

# The user and database names come from the container's own environment (db.env).
$COMPOSE exec -T db sh -c 'pg_dump --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$tmp"
gzip -t "$tmp"
# A real dump always ends with this line; anything else means pg_dump stopped early.
zcat "$tmp" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || { echo "Backup looks incomplete" >&2; exit 1; }
mv "$tmp" "$DIR/$name"
echo "Backup written: $DIR/$name ($(du -h "$DIR/$name" | cut -f1))"

# Copy to S3 too when a bucket is set (the server's IAM role needs s3:PutObject on it)
if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws >/dev/null; then
  aws s3 cp --only-show-errors "$DIR/$name" "s3://$BACKUP_S3_BUCKET/db/$name" && echo "Copied to s3://$BACKUP_S3_BUCKET/db/$name"
fi

# Keep only the newest $KEEP backups on the server.
ls -1t "$DIR"/shop-*.sql.gz | tail -n +$((KEEP + 1)) | while read -r old; do rm -f -- "$old"; echo "Removed old backup: $old"; done
