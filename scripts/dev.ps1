<#
.SYNOPSIS
    Development helper script for Fusion Engine Restaurant SaaS (Windows PowerShell)

.DESCRIPTION
    Provides targets matching the Makefile: up, down, build, migrate, seed, test, lint, typecheck, health
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "build", "migrate", "seed", "test", "lint", "typecheck", "health", "web", "web-test", "e2e", "gen-api", "help")]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "Available commands in scripts/dev.ps1:" -ForegroundColor Cyan
    Write-Host "  .\scripts\dev.ps1 up         - Start all docker containers (Postgres, Redis, Backend, Celery)"
    Write-Host "  .\scripts\dev.ps1 down       - Stop and remove all containers"
    Write-Host "  .\scripts\dev.ps1 build      - Build docker container images"
    Write-Host "  .\scripts\dev.ps1 migrate    - Run database migrations inside backend container"
    Write-Host "  .\scripts\dev.ps1 seed       - Seed database with demo tenants and users"
    Write-Host "  .\scripts\dev.ps1 test       - Run backend pytest test suite with coverage gate"
    Write-Host "  .\scripts\dev.ps1 lint       - Run ruff linter and frontend ESLint"
    Write-Host "  .\scripts\dev.ps1 typecheck  - Run mypy static type checking"
    Write-Host "  .\scripts\dev.ps1 health     - Check system health endpoint"
    Write-Host "  .\scripts\dev.ps1 web        - Start frontend Vite development server"
    Write-Host "  .\scripts\dev.ps1 web-test   - Run frontend Vitest test suite with coverage"
    Write-Host "  .\scripts\dev.ps1 e2e        - Run Playwright end-to-end integration tests"
    Write-Host "  .\scripts\dev.ps1 gen-api    - Regenerate TypeScript types from backend OpenAPI schema"
}

switch ($Command) {
    "up" {
        Write-Host "Starting Docker containers..." -ForegroundColor Green
        docker compose up -d
        docker compose ps
    }
    "down" {
        Write-Host "Stopping Docker containers..." -ForegroundColor Yellow
        docker compose down
    }
    "build" {
        Write-Host "Building Docker images..." -ForegroundColor Green
        docker compose build
    }
    "migrate" {
        Write-Host "Running migrations..." -ForegroundColor Green
        docker compose exec backend python manage.py migrate
    }
    "seed" {
        Write-Host "Seeding database..." -ForegroundColor Green
        docker compose exec backend python manage.py seed
    }
    "test" {
        Write-Host "Running pytest with coverage..." -ForegroundColor Green
        if (-not $env:POSTGRES_HOST_PORT) { $env:POSTGRES_HOST_PORT = "5435" }
        if (-not $env:DB_PORT) { $env:DB_PORT = $env:POSTGRES_HOST_PORT }
        if (-not $env:DB_HOST) { $env:DB_HOST = "127.0.0.1" }
        Push-Location backend
        try {
            pytest apps --cov=apps --cov-report=term-missing --cov-fail-under=90
        } finally {
            Pop-Location
        }
    }
    "lint" {
        Write-Host "Running backend ruff checks..." -ForegroundColor Green
        ruff check backend/apps
        Write-Host "Running frontend lint checks..." -ForegroundColor Green
        Push-Location frontend
        try {
            npm run lint
        } finally {
            Pop-Location
        }
    }
    "typecheck" {
        Write-Host "Running mypy type check..." -ForegroundColor Green
        Push-Location backend
        try {
            mypy apps
        } finally {
            Pop-Location
        }
    }
    "health" {
        Write-Host "Querying health endpoint..." -ForegroundColor Green
        try {
            $resp = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
            $resp | ConvertTo-Json
        } catch {
            Write-Error "Health check failed: $_"
        }
    }
    "web" {
        Write-Host "Starting frontend dev server..." -ForegroundColor Green
        Push-Location frontend
        try {
            npm run dev
        } finally {
            Pop-Location
        }
    }
    "web-test" {
        Write-Host "Running frontend unit and component tests..." -ForegroundColor Green
        Push-Location frontend
        try {
            npm run test:run
        } finally {
            Pop-Location
        }
    }
    "e2e" {
        Write-Host "Running Playwright E2E tests..." -ForegroundColor Green
        Push-Location frontend
        try {
            npx playwright test
        } finally {
            Pop-Location
        }
    }
    "gen-api" {
        Write-Host "Regenerating OpenAPI schema and TypeScript definitions..." -ForegroundColor Green
        Push-Location backend
        try {
            python manage.py spectacular --format openapi-json --validate --file ../docs/openapi.json
        } finally {
            Pop-Location
        }
        Push-Location frontend
        try {
            npm run gen:api
        } finally {
            Pop-Location
        }
    }
    Default {
        Show-Help
    }
}
