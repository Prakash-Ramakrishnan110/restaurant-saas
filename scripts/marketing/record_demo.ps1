$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ffmpeg is not installed. Run: winget install Gyan.FFmpeg" -ForegroundColor Red
    exit 1
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RawDir = Join-Path $RepoRoot "docs\evidence\marketing\raw-video"
$OutDir = Join-Path $RepoRoot "marketing\public\video"
New-Item -ItemType Directory -Force -Path $RawDir, $OutDir | Out-Null

Push-Location (Join-Path $RepoRoot "frontend")
try {
    node (Join-Path $PSScriptRoot "record_demo.mjs") $RawDir
} finally {
    Pop-Location
}

# Convert Restaurant video (<= 8 MB)
$RestRaw = Get-ChildItem -Path (Join-Path $RawDir "restaurant") -Filter "*.webm" | Select-Object -First 1
if ($RestRaw) {
    ffmpeg -y -i $RestRaw.FullName -an -c:v libx264 -preset slow -crf 28 -movflags +faststart -vf "scale=1280:720" (Join-Path $OutDir "restaurant-demo.mp4")
    ffmpeg -y -i $RestRaw.FullName -an -c:v libvpx-vp9 -b:v 450k -vf "scale=1280:720" (Join-Path $OutDir "restaurant-demo.webm")
    ffmpeg -y -i $RestRaw.FullName -ss 00:00:05 -vframes 1 (Join-Path $OutDir "restaurant-frame.png")
}

# Convert Tea Shop video (<= 4 MB)
$TeaRaw = Get-ChildItem -Path (Join-Path $RawDir "teashop") -Filter "*.webm" | Select-Object -First 1
if ($TeaRaw) {
    ffmpeg -y -i $TeaRaw.FullName -an -c:v libx264 -preset slow -crf 28 -movflags +faststart -vf "scale=1280:720" (Join-Path $OutDir "teashop-demo.mp4")
    ffmpeg -y -i $TeaRaw.FullName -an -c:v libvpx-vp9 -b:v 400k -vf "scale=1280:720" (Join-Path $OutDir "teashop-demo.webm")
    ffmpeg -y -i $TeaRaw.FullName -ss 00:00:04 -vframes 1 (Join-Path $OutDir "teashop-frame.png")
}

Write-Host "Demo videos and frames saved to $OutDir"
