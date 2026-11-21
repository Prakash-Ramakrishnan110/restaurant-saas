#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-fusion_postgres}"
DB_NAME="${DB_NAME:-fusion_saas}"
DB_USER="${DB_USER:-postgres}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/servemyfood_${TIMESTAMP}.dump"
SHA_FILE="${DUMP_FILE}.sha256"

echo "[Backup] Creating pg_dump -Fc from ${CONTAINER_NAME} (${DB_NAME})..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -Fc -f "/tmp/servemyfood_${TIMESTAMP}.dump" "$DB_NAME"
docker cp "${CONTAINER_NAME}:/tmp/servemyfood_${TIMESTAMP}.dump" "$DUMP_FILE"
docker exec "$CONTAINER_NAME" rm -f "/tmp/servemyfood_${TIMESTAMP}.dump"

sha256sum "$DUMP_FILE" > "$SHA_FILE"
echo "[Backup] SUCCESS: $DUMP_FILE"
cat "$SHA_FILE"
