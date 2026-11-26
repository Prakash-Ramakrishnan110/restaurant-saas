param(
    [string]$ApiBaseUrl = "http://10.0.2.2:8000"
)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$FrontendDir = Join-Path $RepoRoot "frontend"
$AndroidDir = Join-Path $RepoRoot "mobile\android"
$EvidenceDir = Join-Path $RepoRoot "docs\evidence\mobile"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

# Check tools
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found" }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw "JDK 17 not found" }

# Version from git
$verCode = [int](git rev-list --count HEAD)
$verName = (git describe --tags --always).Trim()

Push-Location $FrontendDir
try {
    $env:VITE_NATIVE = "1"
    $env:VITE_API_BASE_URL = $ApiBaseUrl
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend native build failed" }
    npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }
} finally {
    Pop-Location
}

Push-Location $AndroidDir
try {
    .\gradlew.bat assembleDebug "-PappVersionCode=$verCode" "-PappVersionName=$verName"
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleDebug failed" }
} finally {
    Pop-Location
}

$apkPath = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) { throw "Debug APK not found at $apkPath" }
$sizeBytes = (Get-Item $apkPath).Length
$sha256 = (Get-FileHash $apkPath -Algorithm SHA256).Hash

$report = @"
Build Type: Debug
Version Code: $verCode
Version Name: $verName
API Base URL: $ApiBaseUrl
APK Path: $apkPath
Size (bytes): $sizeBytes
Size (MB): $([math]::Round($sizeBytes / 1MB, 2))
SHA-256: $sha256
"@
$report | Set-Content (Join-Path $EvidenceDir "debug-apk-info.txt") -Encoding UTF8
Write-Output $report
