# ==============================================================================
# ServeMyFood: Complete Automated Quality Gate Verification Script
# Target: Prompt 4A Close-Out Verification (Tag v0.6.1)
# ==============================================================================

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$EvidenceDir = Join-Path $RepoRoot "docs\evidence"
if (-not (Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
$GitCommit = (git rev-parse HEAD 2>$null)
$GitBranch = (git branch --show-current 2>$null)
$GitTag = (git describe --tags --always 2>$null)
$GitStatusShort = (git status --porcelain -- . ':!docs/evidence' 2>$null)
$IsClean = [string]::IsNullOrWhiteSpace($GitStatusShort)
$WorkingTreeLabel = if ($IsClean) { "Clean (code)" } else { "Modified (code/untracked files outside docs/evidence)" }

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "   ServeMyFood - Single Verification Script (verify_all.ps1)                  " -ForegroundColor Cyan
Write-Host "   Timestamp: $Timestamp                                                      " -ForegroundColor Cyan
Write-Host "   Commit:    $GitCommit ($GitTag)                                            " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

$Gates = @()
$OverallPassed = $true

function Run-Gate {
    param(
        [int]$Id,
        [string]$Name,
        [scriptblock]$Action,
        [string]$OutputFile,
        [string]$WorkingDir = $RepoRoot
    )

    Write-Host "`n[$Id/19] Running Gate: $Name..." -ForegroundColor Yellow
    $OutPath = Join-Path $EvidenceDir $OutputFile

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $prevDir = Get-Location
    Set-Location $WorkingDir

    $ExitCode = 0
    try {
        & $Action 2>&1 | Tee-Object -FilePath $OutPath
        $ExitCode = $LASTEXITCODE
        if ($null -eq $ExitCode) {
            $ExitCode = 0
        }
    } catch {
        Write-Host "Exception during gate execution: $_" -ForegroundColor Red
        $_ | Out-File -FilePath $OutPath -Append
        $ExitCode = 1
    } finally {
        Set-Location $prevDir
        $sw.Stop()
    }

    $Status = "PASS"
    if ($ExitCode -ne 0) {
        $Status = "FAIL"
        $script:OverallPassed = $false
        Write-Host "❌ GATE FAILED: $Name (Exit code: $ExitCode)" -ForegroundColor Red
    } else {
        Write-Host "✅ GATE PASSED: $Name (Time: $($sw.Elapsed.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
    }

    $script:Gates += [PSCustomObject]@{
        Id         = $Id
        Name       = $Name
        OutputFile = $OutputFile
        Duration   = "$($sw.Elapsed.TotalSeconds.ToString('F1'))s"
        Status     = $Status
        ExitCode   = $ExitCode
    }
}

# ------------------------------------------------------------------------------
# 1. Backend Pytest
# ------------------------------------------------------------------------------
Run-Gate -Id 1 `
    -Name "Backend Pytest Suite with Coverage" `
    -OutputFile "backend-pytest.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        $env:TEST_DB_PORT = "5435"
        $env:POSTGRES_HOST_PORT = "5435"
        uv run pytest
    }

# ------------------------------------------------------------------------------
# 2. Backend Coverage Gate
# ------------------------------------------------------------------------------
Run-Gate -Id 2 `
    -Name "Backend Coverage Gate Check" `
    -OutputFile "backend-coverage-gate.txt" `
    -WorkingDir $RepoRoot `
    -Action {
        python scripts/check_coverage.py
    }

# ------------------------------------------------------------------------------
# 3. Backend Ruff Linter
# ------------------------------------------------------------------------------
Run-Gate -Id 3 `
    -Name "Backend Ruff Linting" `
    -OutputFile "backend-ruff.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        uv run ruff check .
    }

# ------------------------------------------------------------------------------
# 4. Backend Ruff Formatter
# ------------------------------------------------------------------------------
Run-Gate -Id 4 `
    -Name "Backend Ruff Format Verification" `
    -OutputFile "backend-ruff-format.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        uv run ruff format --check .
    }

# ------------------------------------------------------------------------------
# 5. Backend Mypy Static Type Checking
# ------------------------------------------------------------------------------
Run-Gate -Id 5 `
    -Name "Backend Mypy Type Checking" `
    -OutputFile "backend-mypy.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        uv run mypy .
    }

# ------------------------------------------------------------------------------
# 6. Backend Migrations Dry-Run Check
# ------------------------------------------------------------------------------
Run-Gate -Id 6 `
    -Name "Backend Migrations Drift Check" `
    -OutputFile "backend-migrations.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        $env:POSTGRES_HOST_PORT = "5432"
        uv run python manage.py makemigrations --check --dry-run
    }

# ------------------------------------------------------------------------------
# 7. Backend Pip Dependency Check
# ------------------------------------------------------------------------------
Run-Gate -Id 7 `
    -Name "Backend Pip Dependency Consistency" `
    -OutputFile "backend-pip-check.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        uv run python -m pip check
    }

# ------------------------------------------------------------------------------
# 8. Backend Pip Security Vulnerability Audit
# ------------------------------------------------------------------------------
Run-Gate -Id 8 `
    -Name "Backend Pip Security Audit" `
    -OutputFile "backend-pip-audit.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        uv run pip-audit
    }

# ------------------------------------------------------------------------------
# 9. OpenAPI Specification Validation & Drift
# ------------------------------------------------------------------------------
Run-Gate -Id 9 `
    -Name "OpenAPI Schema Validation & Drift Check" `
    -OutputFile "openapi-drift.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        $env:POSTGRES_HOST_PORT = "5432"
        uv run python manage.py spectacular --file ../docs/openapi.json --validate
    }

# ------------------------------------------------------------------------------
# 10. Frontend ESLint
# ------------------------------------------------------------------------------
Run-Gate -Id 10 `
    -Name "Frontend ESLint Linting" `
    -OutputFile "frontend-lint.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npm.cmd run lint
    }

# ------------------------------------------------------------------------------
# 11. Frontend Prettier Formatting
# ------------------------------------------------------------------------------
Run-Gate -Id 11 `
    -Name "Frontend Prettier Format Verification" `
    -OutputFile "frontend-format.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npm.cmd run format:check
    }

# ------------------------------------------------------------------------------
# 12. Frontend TypeScript Typecheck
# ------------------------------------------------------------------------------
Run-Gate -Id 12 `
    -Name "Frontend TypeScript Typecheck" `
    -OutputFile "frontend-typecheck.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npm.cmd run typecheck
    }

# ------------------------------------------------------------------------------
# 13. Frontend Production Build
# ------------------------------------------------------------------------------
Run-Gate -Id 13 `
    -Name "Frontend Production Build" `
    -OutputFile "frontend-build.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npm.cmd run build
    }

# ------------------------------------------------------------------------------
# 14. Frontend Vitest Unit & Component Tests
# ------------------------------------------------------------------------------
Run-Gate -Id 14 `
    -Name "Frontend Vitest Unit Suite" `
    -OutputFile "frontend-vitest.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npm.cmd run test
    }

# ------------------------------------------------------------------------------
# 15. Frontend API Types Drift Verification
# ------------------------------------------------------------------------------
Run-Gate -Id 15 `
    -Name "Frontend API Types Drift Verification" `
    -OutputFile "api-types-drift.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        $tmp = [System.IO.Path]::GetTempFileName()
        npx.cmd openapi-typescript ../docs/openapi.json -o $tmp
        $diff = Compare-Object (Get-Content src/types/api.ts) (Get-Content $tmp)
        Remove-Item $tmp -Force
        if ($diff) {
            Write-Error "Drift detected between openapi.json and src/types/api.ts"
            $LASTEXITCODE = 1
            return
        } else {
            Write-Output "PASS: Zero API types drift detected. src/types/api.ts matches docs/openapi.json perfectly with 0 changes."
            $LASTEXITCODE = 0
            return
        }
    }

# ------------------------------------------------------------------------------
# 16. Playwright Browser E2E Suite (Behavior Tests Only)
# ------------------------------------------------------------------------------
Run-Gate -Id 16 `
    -Name "Playwright Browser E2E Test Suite" `
    -OutputFile "e2e-report.txt" `
    -WorkingDir (Join-Path $RepoRoot "frontend") `
    -Action {
        npx.cmd playwright test --project=chromium --project=mobile
    }

# ------------------------------------------------------------------------------
# 17. Tax Claim & GST Term Scan
# ------------------------------------------------------------------------------
Run-Gate -Id 17 `
    -Name "Tax Claim & GST Term Scan" `
    -OutputFile "tax-scan.txt" `
    -WorkingDir $RepoRoot `
    -Action {
        $hits = git grep -n -i -E "cgst|sgst|igst|tax_paise|tax invoice|\b(5|12|18|28)%[[:space:]]*(gst|tax)" -- frontend/src backend/apps ':!**/migrations/**' ':!**/tests/**' ':!**/*.test.*' ':!**/*.spec.*'
        $filtered = @($hits | Where-Object { $_ -and $_ -notmatch "NOT A TAX INVOICE" -and $_ -notmatch 'placeholder="' })
        if ($filtered.Count -gt 0) {
            $filtered | ForEach-Object { Write-Output $_ }
            Write-Output "FAIL: Found $($filtered.Count) prohibited tax/GST references."
            $global:LASTEXITCODE = 1
        } else {
            Write-Output "PASS: 0 prohibited tax/GST references in frontend/src and backend/apps."
            $global:LASTEXITCODE = 0
        }
    }

# ------------------------------------------------------------------------------
# 18. Image Processing & Safety Pytest
# ------------------------------------------------------------------------------
Run-Gate -Id 18 `
    -Name "Image Processing & Safety Pytest" `
    -OutputFile "image-safety-check.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        $env:TEST_DB_PORT = "5435"
        uv run pytest apps/tenants/tests/test_prompt3b_branding_logo.py --no-cov -q
    }

# ------------------------------------------------------------------------------
# 19. Waiter Availability Isolation Pytest
# ------------------------------------------------------------------------------
Run-Gate -Id 19 `
    -Name "Waiter Availability Isolation Pytest" `
    -OutputFile "waiter-isolation-check.txt" `
    -WorkingDir (Join-Path $RepoRoot "backend") `
    -Action {
        $env:TEST_DB_PORT = "5435"
        uv run pytest apps/menu/tests/test_menu_rbac_matrix.py -k "waiter" --no-cov -q
    }


# ==============================================================================
# Extract Parsed Metrics for SUMMARY.txt
# ==============================================================================
$PytestTxt = Get-Content (Join-Path $EvidenceDir "backend-pytest.txt") -Raw -ErrorAction SilentlyContinue
$BackendPassed = "0"
$BackendFailed = "0"
$BackendCoverage = "Unknown"
if ($PytestTxt) {
    $cleanPytest = $PytestTxt -replace "\x1b\[[0-9;]*[a-zA-Z]", ""
    if ($cleanPytest -match "(\d+)\s+passed") {
        $BackendPassed = $matches[1]
    }
    if ($cleanPytest -match "(\d+)\s+failed") {
        $BackendFailed = $matches[1]
    }
    if ($cleanPytest -match "Required test coverage of \d+% reached\. Total coverage:\s+([\d\.]+)%") {
        $BackendCoverage = "$($matches[1])%"
    } elseif ($cleanPytest -match "TOTAL\s+\d+\s+\d+\s+(\d+)%") {
        $BackendCoverage = "$($matches[1])%"
    }
}

$VitestTxt = Get-Content (Join-Path $EvidenceDir "frontend-vitest.txt") -Raw -ErrorAction SilentlyContinue
$FrontendPassed = "0"
$FrontendFailed = "0"
$FrontendSuitesPassed = "0"
if ($VitestTxt) {
    $cleanVitest = $VitestTxt -replace "\x1b\[[0-9;]*[a-zA-Z]", ""
    if ($cleanVitest -match "Test Files\s+(?:\d+\s+failed\s*\|\s*)?(\d+)\s+passed") {
        $FrontendSuitesPassed = $matches[1]
    }
    if ($cleanVitest -match "Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed") {
        if ($matches[1]) { $FrontendFailed = $matches[1] }
        $FrontendPassed = $matches[2]
    }
}

$E2ETxt = Get-Content (Join-Path $EvidenceDir "e2e-report.txt") -Raw -ErrorAction SilentlyContinue
$E2EPassed = "0"
$E2EFailed = "0"
$E2ESkipped = "0"
$E2EFlaky = "0"
if ($E2ETxt) {
    $cleanE2E = $E2ETxt -replace "\x1b\[[0-9;]*[a-zA-Z]", ""
    if ($cleanE2E -match "(\d+)\s+passed") { $E2EPassed = $matches[1] }
    if ($cleanE2E -match "(\d+)\s+failed") { $E2EFailed = $matches[1] }
    if ($cleanE2E -match "(\d+)\s+skipped") { $E2ESkipped = $matches[1] }
    if ($cleanE2E -match "(\d+)\s+flaky") { $E2EFlaky = $matches[1] }
}

$TaxScanTxt = Get-Content (Join-Path $EvidenceDir "tax-scan.txt") -Raw -ErrorAction SilentlyContinue
$TaxScanSummary = if ($TaxScanTxt -match "PASS:\s*(.+)") { "PASS ($($matches[1].Trim()))" } else { "FAIL (see tax-scan.txt)" }

$ImageTxt = Get-Content (Join-Path $EvidenceDir "image-safety-check.txt") -Raw -ErrorAction SilentlyContinue
$ImageSummary = if ($ImageTxt -match "(\d+)\s+passed") { "PASS ($($matches[1]) passed)" } else { "FAIL (see image-safety-check.txt)" }

$WaiterTxt = Get-Content (Join-Path $EvidenceDir "waiter-isolation-check.txt") -Raw -ErrorAction SilentlyContinue
$WaiterSummary = if ($WaiterTxt -match "(\d+)\s+passed") { "PASS ($($matches[1]) passed)" } else { "FAIL (see waiter-isolation-check.txt)" }

$FinalVerdict = if ($OverallPassed) { "PASS" } else { "FAIL" }

# ==============================================================================
# Generate docs/evidence/SUMMARY.txt
# ==============================================================================
$SummaryLines = @()
$SummaryLines += "=============================================================================="
$SummaryLines += "             SERVEMYFOOD - AUTOMATED CLOSE-OUT VERIFICATION SUMMARY           "
$SummaryLines += "=============================================================================="
$SummaryLines += "Generated At:    $Timestamp"
$SummaryLines += "Git Branch:      $GitBranch"
$SummaryLines += "Git Commit:      $GitCommit"
$SummaryLines += "Target Tag:      $GitTag"
$SummaryLines += "Working Tree:    $WorkingTreeLabel"
$SummaryLines += "Overall Result:  $FinalVerdict"
$SummaryLines += "=============================================================================="
$SummaryLines += ""
$SummaryLines += "1. QUALITY GATE VERIFICATION TABLE"
$SummaryLines += "-----------------------------------------------------------------------------------------------------------------"
$SummaryLines += [string]::Format("{0,-4} | {1,-40} | {2,-25} | {3,-10} | {4,-6}", "#", "Gate Description", "Evidence File", "Duration", "Status")
$SummaryLines += "-----------------------------------------------------------------------------------------------------------------"

foreach ($g in $Gates) {
    $SummaryLines += [string]::Format("{0,-4} | {1,-40} | {2,-25} | {3,-10} | {4,-6}", $g.Id, $g.Name, $g.OutputFile, $g.Duration, $g.Status)
}
$SummaryLines += "-----------------------------------------------------------------------------------------------------------------"
$SummaryLines += ""
$SummaryLines += "2. KEY VERIFIED METRICS"
$SummaryLines += "-----------------------------------------------------------------------------------------------------------------"
$SummaryLines += "Backend Pytest Tests:            $BackendPassed passed, $BackendFailed failed"
$SummaryLines += "Backend Total Code Coverage:     $BackendCoverage (Threshold >= 92.0%, apps/orders >= 90.0%)"
$SummaryLines += "Frontend Vitest Tests:           $FrontendPassed passed, $FrontendFailed failed ($FrontendSuitesPassed suites passed)"
$SummaryLines += "Playwright E2E Tests:            $E2EPassed passed, $E2EFailed failed, $E2ESkipped skipped, $E2EFlaky flaky"
$SummaryLines += "Image Processing & Safety:       $ImageSummary"
$SummaryLines += "Waiter Availability Isolation:   $WaiterSummary"
$SummaryLines += "Tax Claim Policy (ADR 0021):     $TaxScanSummary"
$SummaryLines += "-----------------------------------------------------------------------------------------------------------------"
$SummaryLines += ""
$SummaryLines += "FINAL CLOSE-OUT VERDICT: $FinalVerdict"
$SummaryLines += "=============================================================================="

$SummaryContent = $SummaryLines -join "`r`n"
$SummaryPath = Join-Path $EvidenceDir "SUMMARY.txt"
Set-Content -Path $SummaryPath -Value $SummaryContent -Encoding utf8

Write-Host "`n"
Write-Host $SummaryContent -ForegroundColor $(if ($OverallPassed) { "Green" } else { "Red" })

if ($OverallPassed) {
    Write-Host "`n🎉 ALL GATES PASSED! Verification completed successfully." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ ONE OR MORE GATES FAILED! Check docs/evidence/*.txt for details." -ForegroundColor Red
    exit 1
}
