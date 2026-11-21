# ServeMyFood PostgreSQL Custom-Format Backup Script (Windows PowerShell)
param(
    [string]$ContainerName = "fusion_postgres",
    [string]$DbName = "fusion_saas",
    [string]$DbUser = "postgres",
    [string]$BackupDir = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $BackupDir) {
    $BackupDir = Join-Path $RepoRoot "backups"
}
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$DumpFile = Join-Path $BackupDir "servemyfood_$Timestamp.dump"
$ShaFile = "$DumpFile.sha256"

Write-Output "[Backup] Creating pg_dump -Fc from $ContainerName ($DbName)..."
docker exec $ContainerName pg_dump -U $DbUser -Fc -f "/tmp/servemyfood_$Timestamp.dump" $DbName
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}
docker cp "${ContainerName}:/tmp/servemyfood_$Timestamp.dump" $DumpFile
docker exec $ContainerName rm -f "/tmp/servemyfood_$Timestamp.dump"

$Hash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash.ToLower()
"$Hash  $(Split-Path $DumpFile -Leaf)" | Set-Content -Path $ShaFile -Encoding UTF8

Write-Output "[Backup] SUCCESS: $DumpFile"
Write-Output "[Backup] SHA-256: $Hash"
