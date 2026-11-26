$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$EvidenceDir = Join-Path $RepoRoot "docs\evidence\mobile"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    $msg = "SKIPPED: adb not found on PATH."
    $msg | Set-Content (Join-Path $EvidenceDir "emulator-smoke.txt") -Encoding UTF8
    Write-Output $msg
    exit 0
}

$devices = (& adb devices) | Select-String "\tdevice$"
if (-not $devices) {
    $msg = "SKIPPED: No running Android emulator or USB-connected device found."
    $msg | Set-Content (Join-Path $EvidenceDir "emulator-smoke.txt") -Encoding UTF8
    Write-Output $msg
    exit 0
}

$apk = Join-Path $RepoRoot "mobile\android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
    throw "Debug APK missing at $apk. Run build_debug.ps1 first."
}

& adb install -r $apk
& adb shell am start -n in.fusionengine.servemyfood.staff/.MainActivity
Start-Sleep -Seconds 5
& adb exec-out screencap -p > (Join-Path $EvidenceDir "emulator-launch.png")
"PASS: Installed and launched on connected Android device/emulator." | Set-Content (Join-Path $EvidenceDir "emulator-smoke.txt") -Encoding UTF8
