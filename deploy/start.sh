#!/usr/bin/env sh
set -eu

export PORT="${PORT:-8080}"

echo "[start.sh] Running Django migrations..."
python manage.py migrate --noinput

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
