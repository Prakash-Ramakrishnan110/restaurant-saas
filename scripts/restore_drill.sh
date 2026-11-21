#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-fusion_postgres}"
SOURCE_DB="${SOURCE_DB:-fusion_saas}"
DRILL_DB="${DRILL_DB:-servemyfood_restore_drill}"
DB_USER="${DB_USER:-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/backups"

"$SCRIPT_DIR/backup_db.sh"
LATEST_DUMP="$(ls -t "$BACKUP_DIR"/servemyfood_*.dump | head -n 1)"
sha256sum -c "${LATEST_DUMP}.sha256"

docker cp "$LATEST_DUMP" "${CONTAINER_NAME}:/tmp/restore_drill.dump"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DRILL_DB};"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DRILL_DB};"

cleanup() {
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null 2>&1 || true
  docker exec "$CONTAINER_NAME" rm -f /tmp/restore_drill.dump >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$CONTAINER_NAME" pg_restore -U "$DB_USER" -d "$DRILL_DB" --no-owner --no-privileges /tmp/restore_drill.dump
DRIFTS="$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DRILL_DB" -t -A -c "SELECT COUNT(*) FROM (SELECT sl.item_id, sl.location_id FROM inventory_stocklevel sl LEFT JOIN inventory_stockmovement sm ON sm.item_id = sl.item_id AND sm.location_id = sl.location_id GROUP BY sl.item_id, sl.location_id, sl.quantity HAVING sl.quantity - COALESCE(SUM(sm.quantity), 0) <> 0) d;")"
if [ "$DRIFTS" -ne 0 ]; then
  echo "[Restore Drill] FAIL: Stock ledger drift count = $DRIFTS"
  exit 1
fi
echo "[Restore Drill] PASS: Ephemeral restore and ledger invariant check succeeded."
