$ErrorActionPreference = "Continue"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$MarketingDir = Join-Path $RepoRoot "marketing"
$EvidenceDir = Join-Path $RepoRoot "docs\evidence\marketing"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $EvidenceDir "shots") | Out-Null

$Results = @()
$AnyFailed = $false

function Run-MarketingGate {
    param([int]$Id, [string]$Name, [string]$OutFile, [scriptblock]$Action)
    Write-Host "`n[$Id] $Name..." -ForegroundColor Cyan
    $logPath = Join-Path $EvidenceDir $OutFile
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $output = & $Action 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $sw.Stop()
    Set-Content -Path $logPath -Value $output -Encoding UTF8
    $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    if ($exitCode -ne 0) {
        $script:AnyFailed = $true
        Write-Host "FAIL: $Name (see $OutFile)" -ForegroundColor Red
    } else {
        Write-Host "PASS: $Name ($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
    }
    $script:Results += [PSCustomObject]@{ Id = $Id; Name = $Name; File = $OutFile; Status = $status; Sec = [math]::Round($sw.Elapsed.TotalSeconds, 1) }
}

Push-Location $MarketingDir
try {
    Run-MarketingGate -Id 1 -Name "Marketing TypeScript Typecheck" -OutFile "typecheck.txt" -Action {
        npm run typecheck
    }

    Run-MarketingGate -Id 2 -Name "Prerender Build (Draft-Allowed Preview)" -OutFile "build.txt" -Action {
        $env:MARKETING_ALLOW_DRAFT = "1"
        npm run build
    }

    Run-MarketingGate -Id 3 -Name "Static HTML, Forbidden Claims, Tea-Shop Zero-Table & JS Budget" -OutFile "static-checks.txt" -Action {
        node scripts/check_static.mjs
    }

    Run-MarketingGate -Id 4 -Name "Playwright A11y, Responsive, Animation, Form & 3rd-Party Checks" -OutFile "playwright.txt" -Action {
        docker exec fusion_redis redis-cli -a devredispassword DEL ":1:lead:ip:127.0.0.1" 2>$null | Out-Null
        docker compose exec -T redis redis-cli -a devredispassword DEL ":1:lead:ip:127.0.0.1" 2>$null | Out-Null
        npx playwright test
    }

    Run-MarketingGate -Id 5 -Name "Lighthouse Mobile Audit (Home EN)" -OutFile "lighthouse.txt" -Action {
        $proc = Start-Process -FilePath "node" -ArgumentList "./node_modules/vite/bin/vite.js", "preview", "--port", "4173", "--host", "127.0.0.1" -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
        try {
            $lhJson = Join-Path $EvidenceDir "lighthouse-home.report.json"
            npx lighthouse "http://127.0.0.1:4173/" --preset=perf --only-categories=performance,accessibility,seo --output=json --output-path="$lhJson" --chrome-flags="--headless=new --no-sandbox" --quiet
            node -e "const r=JSON.parse(require('fs').readFileSync('$($lhJson -replace '\\','\\\\')','utf8')); const c=r.categories; const p=Math.round(c.performance.score*100); const a=Math.round(c.accessibility.score*100); const s=Math.round(c.seo.score*100); console.log({p,a,s}); if(p<90||a<95||s<95) process.exit(1);"
        } finally {
            if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
        }
    }
} finally {
    Pop-Location
}

$verdict = if ($AnyFailed) { "FAIL" } else { "PASS" }
$summary = @()
$summary += "SERVEMYFOOD MARKETING - VERIFICATION SUMMARY"
$summary += "Generated At: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
$summary += "Overall Verdict: $verdict"
$summary += ""
foreach ($r in $Results) {
    $summary += ("{0}. {1,-65} | {2,-4} | {3}s | {4}" -f $r.Id, $r.Name, $r.Status, $r.Sec, $r.File)
}
Set-Content -Path (Join-Path $EvidenceDir "SUMMARY.txt") -Value ($summary -join "`n") -Encoding UTF8
Get-Content (Join-Path $EvidenceDir "SUMMARY.txt")
if ($AnyFailed) { exit 1 }
