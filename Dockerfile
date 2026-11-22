# syntax=docker/dockerfile:1

# --- Stage 1: Build Marketing Static Site ---
FROM node:20-alpine AS marketing-builder
WORKDIR /build/marketing
COPY marketing/package*.json ./
RUN npm ci --legacy-peer-deps
COPY marketing/ ./
RUN npm run build

# --- Stage 2: Build React Staff & Customer QR App ---
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# --- Stage 3: Production Runtime (Django Daphne + Nginx) ---
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    nginx \
    gettext-base \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY --from=marketing-builder /build/marketing/dist /app/web/marketing
COPY --from=frontend-builder /build/frontend/dist /app/web/frontend
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/start.sh /app/start.sh

RUN chmod +x /app/start.sh && mkdir -p /app/staticfiles /app/media

EXPOSE 8080

CMD ["/app/start.sh"]
