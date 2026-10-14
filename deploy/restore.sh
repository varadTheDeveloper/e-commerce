#!/usr/bin/env bash
# Restores a backup into a NEW, separate database. It never touches the live database.
# Usage: sudo /opt/shop/app/deploy/restore.sh /opt/shop/backups/shop-YYYYMMDD-HHMMSS.sql.gz [new_db_name]
# Afterwards, look at the data with:
#   sudo docker compose -f /opt/shop/app/deploy/docker-compose.yml exec db psql -U shop -d <new_db_name>
# and remove it when done:
#   sudo docker compose -f /opt/shop/app/deploy/docker-compose.yml exec db dropdb -U shop <new_db_name>
set -euo pipefail
COMPOSE="docker compose -f /opt/shop/app/deploy/docker-compose.yml"
file="${1:-}"
target="${2:-shop_restore_$(date -u +%Y%m%d_%H%M%S)}"

[[ -f "$file" ]] || { echo "Usage: $0 <backup.sql.gz> [new_db_name]"; exit 1; }
[[ "$target" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "Database name may only use a-z, 0-9 and _"; exit 1; }
gzip -t "$file"

live=$($COMPOSE exec -T db sh -c 'printf %s "$POSTGRES_DB"')
[[ "$target" != "$live" && "$target" != postgres && "$target" != template0 && "$target" != template1 ]] \
  || { echo "Refusing: '$target' is the live or a system database."; exit 1; }
exists=$($COMPOSE exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -tAc "select 1 from pg_database where datname = '"'$target'"'"')
[[ -z "$exists" ]] || { echo "Refusing: database '$target' already exists. Pick a new name."; exit 1; }

$COMPOSE exec -T db sh -c 'createdb -U "$POSTGRES_USER" "$1"' _ "$target"
zcat "$file" | $COMPOSE exec -T db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" >/dev/null' _ "$target"
echo "Restored $file into the new database '$target' (the live database '$live' was not touched)."
