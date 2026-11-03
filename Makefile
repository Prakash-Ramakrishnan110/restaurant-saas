.PHONY: help up down migrate test lint typecheck seed build shell

help:
	@echo "Available commands:"
	@echo "  make up          - Start all docker containers"
	@echo "  make down        - Stop and remove all containers"
	@echo "  make build       - Build docker images"
	@echo "  make migrate     - Run database migrations"
	@echo "  make test        - Run test suite with pytest and coverage"
	@echo "  make lint        - Run ruff linter and formatter checks"
	@echo "  make typecheck   - Run mypy type checking"
	@echo "  make seed        - Run seed management command for demo tenants"
	@echo "  make shell       - Open Django shell inside backend container"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

migrate:
	docker compose exec backend python manage.py migrate

test:
	pytest backend/apps --cov=backend/apps --cov-report=term-missing --cov-fail-under=90

lint:
	ruff check backend
	ruff format --check backend

typecheck:
	mypy backend

seed:
	docker compose exec backend python manage.py seed
