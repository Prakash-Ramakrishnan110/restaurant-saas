<#
.SYNOPSIS
    Development helper script for Fusion Engine Restaurant SaaS (Windows PowerShell)

.DESCRIPTION
    Provides targets matching the Makefile: up, down, build, migrate, seed, test, lint, typecheck, health
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "build", "migrate", "seed", "test", "lint", "typecheck", "health", "help")]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "Available commands in scripts/dev.ps1:" -ForegroundColor Cyan
    Write-Host "  .\scripts\dev.ps1 up         - Start all docker containers (Postgres, Redis, Backend, Celery)"
    Write-Host "  .\scripts\dev.ps1 down       - Stop and remove all containers"
    Write-Host "  .\scripts\dev.ps1 build      - Build docker container images"
    Write-Host "  .\scripts\dev.ps1 migrate    - Run database migrations inside backend container"
    Write-Host "  .\scripts\dev.ps1 seed       - Seed database with demo tenants and users"
    Write-Host "  .\scripts\dev.ps1 test       - Run pytest test suite with coverage gate"
    Write-Host "  .\scripts\dev.ps1 lint       - Run ruff linter and formatting checks"
    Write-Host "  .\scripts\dev.ps1 typecheck  - Run mypy static type checking"
    Write-Host "  .\scripts\dev.ps1 health     - Check system health endpoint"
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
        Write-Host "Running ruff checks..." -ForegroundColor Green
        ruff check backend
        ruff format --check backend
    }
    "typecheck" {
        Write-Host "Running mypy type check..." -ForegroundColor Green
        Push-Location backend
        try {
            mypy apps config
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
    Default {
        Show-Help
    }
}
