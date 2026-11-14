# Audit Step 9: Quality Gates Runner
# Executes all quality gates, records raw outputs in docs/audit/raw/,
# and produces docs/audit/gates.md

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RawDir = Join-Path $RepoRoot "docs\audit\raw"
$GatesFile = Join-Path $RepoRoot "docs\audit\gates.md"

if (!(Test-Path $RawDir)) {
    New-Item -ItemType Directory -Force -Path $RawDir | Out-Null
}

$Gates = [System.Collections.Generic.List[PSObject]]::new()

function Run-Audit-Gate {
    param (
        [string]$Id,
        [string]$Name,
        [string]$Command,
        [string]$RawFileName,
        [string]$WorkingDir,
        [scriptblock]$Action
    )

    Write-Host "`n>>> Running Gate $($Id): $Name..." -ForegroundColor Cyan
    $RawPath = Join-Path $RawDir $RawFileName
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    $exitCode = 0
    Push-Location $WorkingDir
    try {
        & $Action *>&1 | Tee-Object -FilePath $RawPath
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
    } catch {
        $_ | Out-File -Append -FilePath $RawPath
        $exitCode = 1
    } finally {
        Pop-Location
        $stopwatch.Stop()
    }

    $durationSec = [math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
    Write-Host ">>> Finished Gate $($Id): ExitCode=$exitCode, Duration=${durationSec}s" -ForegroundColor Yellow

    $gateObj = [PSCustomObject]@{
        Id = $Id
        Name = $Name
        Command = $Command
        RawFile = $RawFileName
        ExitCode = $exitCode
        Duration = "${durationSec}s"
        Summary = ""
    }
    $Gates.Add($gateObj)
}

# 1. Backend Pytest
Run-Audit-Gate -Id "1" -Name "Backend Pytest with Coverage" -Command "pytest --cov=apps" -RawFileName "backend-pytest.txt" -WorkingDir (Join-Path $RepoRoot "backend") -Action {
    $env:TEST_DB_PORT = "5435"
    $env:POSTGRES_HOST_PORT = "5435"
    uv run pytest --cov=apps --cov-report=term-missing
}

# 2. Ruff Linter
Run-Audit-Gate -Id "2" -Name "Backend Ruff Linter" -Command "ruff check ." -RawFileName "backend-ruff.txt" -WorkingDir (Join-Path $RepoRoot "backend") -Action {
    uv run ruff check .
}

# 3. Mypy Typecheck
Run-Audit-Gate -Id "3" -Name "Backend Mypy Typecheck" -Command "mypy ." -RawFileName "backend-mypy.txt" -WorkingDir (Join-Path $RepoRoot "backend") -Action {
    uv run mypy .
}

# 4. Makemigrations --check
Run-Audit-Gate -Id "4" -Name "Backend Makemigrations Check" -Command "python manage.py makemigrations --check --dry-run" -RawFileName "backend-makemigrations.txt" -WorkingDir (Join-Path $RepoRoot "backend") -Action {
    $env:TEST_DB_PORT = "5435"
    $env:POSTGRES_HOST_PORT = "5435"
    uv run python manage.py makemigrations --check --dry-run
}

# 5. Pip Audit
Run-Audit-Gate -Id "5" -Name "Backend Pip Audit" -Command "pip-audit" -RawFileName "backend-pip-audit.txt" -WorkingDir (Join-Path $RepoRoot "backend") -Action {
    uv run pip-audit
}

# 6. Frontend Lint
Run-Audit-Gate -Id "6" -Name "Frontend ESLint" -Command "npm run lint" -RawFileName "frontend-lint.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npm run lint
}

# 7. Frontend Typecheck
Run-Audit-Gate -Id "7" -Name "Frontend Typecheck (tsc)" -Command "npx tsc --noEmit" -RawFileName "frontend-typecheck.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npx tsc --noEmit
}

# 8. Frontend Vitest with Coverage
Run-Audit-Gate -Id "8" -Name "Frontend Vitest with Coverage" -Command "npx vitest run --coverage" -RawFileName "frontend-vitest.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npx vitest run --coverage
}

# 9. Frontend Build
Run-Audit-Gate -Id "9" -Name "Frontend Production Build" -Command "npm run build" -RawFileName "frontend-build.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npm run build
}

# 10. API Types Drift Check
Run-Audit-Gate -Id "10" -Name "Frontend API Types Drift" -Command "openapi-typescript diff" -RawFileName "frontend-api-types.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npx openapi-typescript ../docs/openapi.json -o src/types/api.ts
    git diff --exit-code src/types/api.ts
}

# 11. NPM Audit (High & Critical)
Run-Audit-Gate -Id "11" -Name "Frontend NPM Audit (High/Critical)" -Command "npm audit --audit-level=high" -RawFileName "frontend-npm-audit.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npm audit --audit-level=high
}

# 12. Playwright --list
Run-Audit-Gate -Id "12" -Name "Playwright E2E Test List" -Command "npx playwright test --list" -RawFileName "playwright-list.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npx playwright test --list
}

# 13. Playwright E2E Run
Run-Audit-Gate -Id "13" -Name "Playwright E2E Test Run" -Command "npx playwright test" -RawFileName "playwright-run.txt" -WorkingDir (Join-Path $RepoRoot "frontend") -Action {
    npx playwright test
}

Write-Host "`nAll quality gates executed. Parsing results into docs/audit/gates.md..." -ForegroundColor Green

# Parse and build gates.md
$md = [System.Collections.Generic.List[string]]::new()
$md.Add("# Quality Gates Audit")
$md.Add("")
$md.Add("Execution record of all backend and frontend quality gates.")
$md.Add("")
$md.Add("| Gate # | Gate Name | Command / Script | Status | Exit Code | Duration | Outcome / Parsed Metrics | Evidence Raw File |")
$md.Add("|---|---|---|---|---|---|---|---|")

$allPassed = $true
foreach ($g in $Gates) {
    $rawPath = Join-Path $RawDir $g.RawFile
    $rawContent = if (Test-Path $rawPath) { Get-Content $rawPath -Raw -ErrorAction SilentlyContinue } else { "" }
    $cleanContent = $rawContent -replace "\x1b\[[0-9;]*[a-zA-Z]", ""
    $gateStatus = if ($g.ExitCode -eq 0) { "PASS" } else { "FAIL"; $allPassed = $false }

    $summary = $g.Summary
    if (!$summary) {
        if ($g.Id -eq "1") {
            # Backend Pytest
            $parts = @()
            if ($cleanContent -match "(\d+\s+failed,\s*\d+\s+passed|\d+\s+passed|\d+\s+failed|\d+\s+error[s]?)") {
                $parts += $Matches[1].Trim()
            }
            if ($cleanContent -match "Total coverage:\s*([\d.]+%)") {
                $parts += "coverage $($Matches[1])"
            }
            if ($parts.Count -gt 0) { $summary = $parts -join ", " }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "2") {
            # Ruff
            if ($cleanContent -match "All checks passed") { $summary = "0 errors, all checks passed" }
            elseif ($cleanContent -match "Found (\d+) errors?") { $summary = "$($Matches[1]) lint errors" }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "3") {
            # Mypy
            if ($cleanContent -match "Success: no issues found") { $summary = "Success: 0 type issues" }
            elseif ($cleanContent -match "Found (\d+) errors?") { $summary = "$($Matches[1]) mypy errors" }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "4") {
            # Makemigrations
            if ($cleanContent -match "No changes detected") { $summary = "No pending migrations" }
            else { $summary = "Migrations detected or error" }
        } elseif ($g.Id -eq "5") {
            # Pip audit
            if ($cleanContent -match "No known vulnerabilities found") { $summary = "0 vulnerabilities found" }
            else { $summary = "Vulnerabilities or audit failure" }
        } elseif ($g.Id -eq "6") {
            # ESLint
            if ($cleanContent -match "(\d+) problems? \((\d+) errors?, (\d+) warnings?\)") {
                $summary = "$($Matches[2]) errors, $($Matches[3]) warnings"
            } elseif ($g.ExitCode -eq 0) { $summary = "0 errors, 0 warnings" }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "7") {
            # Frontend Typecheck
            if ($g.ExitCode -eq 0) { $summary = "0 TypeScript errors" }
            else { $summary = "TypeScript compile errors found" }
        } elseif ($g.Id -eq "8") {
            # Vitest
            if ($cleanContent -match "Tests\s+([^\r\n]+)") {
                $summary = "Tests " + $Matches[1].Trim()
            } elseif ($g.ExitCode -eq 0) { $summary = "Vitest passed" }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "9") {
            # Build
            if ($cleanContent -match "built in ([\d\.]+[m]?s)") { $summary = "Build succeeded in $($Matches[1])" }
            elseif ($g.ExitCode -eq 0) { $summary = "Build succeeded" }
            else { $summary = "Build failed" }
        } elseif ($g.Id -eq "10") {
            # API Types
            if ($g.ExitCode -eq 0) { $summary = "In sync (0 drift against openapi.json)" }
            else { $summary = "Drift detected against openapi.json" }
        } elseif ($g.Id -eq "11") {
            # NPM Audit
            if ($cleanContent -match "found 0 vulnerabilities") { $summary = "0 vulnerabilities" }
            elseif ($cleanContent -match "(\d+\s+(?:moderate|high|critical|low)\s+severity\s+vulnerabilities|\d+\s+vulnerabilities[^\r\n]*)") {
                $summary = $Matches[1].Trim()
            } else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "12") {
            # Playwright List
            if ($cleanContent -match "Total: (\d+) tests?") { $summary = "$($Matches[1]) E2E tests listed" }
            else { $summary = "Exit code $($g.ExitCode)" }
        } elseif ($g.Id -eq "13") {
            # Playwright Run
            $pwParts = @()
            if ($cleanContent -match "(?m)^\s*(\d+\s+failed)\s*$") { $pwParts += $Matches[1].Trim() }
            if ($cleanContent -match "(?m)^\s*(\d+\s+passed[^\r\n]*)") { $pwParts += $Matches[1].Trim() }
            if ($pwParts.Count -gt 0) {
                $summary = $pwParts -join ", "
            } else { $summary = "Exit code $($g.ExitCode)" }
        }
    }

    $bt = [char]96
    $cmdText = "$bt$($g.Command)$bt"
    $rawText = "${bt}docs/audit/raw/$($g.RawFile)${bt}"
    $md.Add("| $($g.Id) | $($g.Name) | $cmdText | $gateStatus | $($g.ExitCode) | $($g.Duration) | $summary | $rawText |")
}

$overallVerdict = if ($allPassed) { "PASS" } else { "FAIL" }
$md.Insert(4, "**Overall Quality Gates Status:** **$overallVerdict**")
$md.Insert(5, "")

$md.Add("")
$md.Add("## Working Tree Status")
$md.Add("")
$gitStatusLines = git status --short
$md.Add('```')
if (!$gitStatusLines) {
    $md.Add("CLEAN")
} else {
    foreach ($line in $gitStatusLines) {
        $md.Add($line)
    }
}
$md.Add('```')
$md.Add("")
$md.Add("## Stubs in E2E Tests (`page.route`)")
$md.Add("")
$md.Add("List of all server network mocks identified in `frontend/e2e`: documented in `docs/audit/raw/e2e-stubs.txt`.")

$md | Out-File -FilePath $GatesFile -Encoding utf8
Write-Host "docs/audit/gates.md generated successfully!" -ForegroundColor Green
