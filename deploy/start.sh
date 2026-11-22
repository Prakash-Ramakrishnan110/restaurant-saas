#!/usr/bin/env sh
set -eu

export PORT="${PORT:-8080}"

echo "[start.sh] Available environment variables: $(env | cut -d= -f1 | sort | tr '\n' ' ')"
echo "[start.sh] DATABASE_URL is set: $(if [ -n "${DATABASE_URL:-}" ]; then echo "YES (len ${#DATABASE_URL})"; else echo "NO"; fi)"
echo "[start.sh] PGHOST is set: $(if [ -n "${PGHOST:-}" ]; then echo "YES ($PGHOST)"; else echo "NO"; fi)"

echo "[start.sh] Checking database settings..."
python -c "
import os
from config.settings.base import DATABASES
db = DATABASES['default']
print(f\"[start.sh] Database engine: {db.get('ENGINE')}, host: {db.get('HOST')}, port: {db.get('PORT')}, name: {db.get('NAME')}\")
" || true

echo "[start.sh] Waiting for database connection..."
for i in $(seq 1 20); do
  if python -c "
import django; django.setup()
from django.db import connection
connection.ensure_connection()
" 2>/dev/null; then
    echo "[start.sh] Database connection successful!"
    break
  fi
  echo "[start.sh] Database not ready yet... waiting (attempt $i/20)"
  sleep 2
done

echo "[start.sh] Running Django migrations..."
python manage.py migrate --noinput

echo "[start.sh] Ensuring base and demo seed data exists..."
python manage.py seed || true

echo "[start.sh] Collecting static files..."
python manage.py collectstatic --noinput

echo "[start.sh] Starting Daphne ASGI server on 127.0.0.1:8000..."
daphne -b 127.0.0.1 -p 8000 config.asgi:application &
DAPHNE_PID=$!

cleanup() {
  kill -TERM "$DAPHNE_PID" 2>/dev/null || true
}
trap cleanup INT TERM

echo "[start.sh] Rendering Nginx config for port ${PORT}..."
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "[start.sh] Starting Nginx..."
exec nginx -g "daemon off;"
