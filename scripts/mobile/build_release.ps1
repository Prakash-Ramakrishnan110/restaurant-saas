param(
    [string]$EnvName = "production",
    [string]$ApiBaseUrl = ""
)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$FrontendDir = Join-Path $RepoRoot "frontend"
$AndroidDir = Join-Path $RepoRoot "mobile\android"
$EvidenceDir = Join-Path $RepoRoot "docs\evidence\mobile"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

if (-not $ApiBaseUrl) {
    $envJson = Get-Content (Join-Path $RepoRoot "mobile\config\environments.json") -Raw | ConvertFrom-Json
    $ApiBaseUrl = $envJson.$EnvName.apiBaseUrl
}

# Check tools
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found" }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw "JDK 17 not found" }

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
    .\gradlew.bat assembleRelease "-PappVersionCode=$verCode" "-PappVersionName=$verName"
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleRelease failed" }
} finally {
    Pop-Location
}

$apkUnsigned = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release-unsigned.apk"
$apkSigned = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
$apkPath = if (Test-Path $apkSigned) { $apkSigned } elseif (Test-Path $apkUnsigned) { $apkUnsigned } else { throw "Release APK not found" }

$sizeBytes = (Get-Item $apkPath).Length
$sha256 = (Get-FileHash $apkPath -Algorithm SHA256).Hash

$report = @"
Build Type: Release ($EnvName)
Version Code: $verCode
Version Name: $verName
API Base URL: $ApiBaseUrl
APK Path: $apkPath
Size (bytes): $sizeBytes
Size (MB): $([math]::Round($sizeBytes / 1MB, 2))
SHA-256: $sha256
"@
$report | Set-Content (Join-Path $EvidenceDir "release-apk-info.txt") -Encoding UTF8
Write-Output $report
