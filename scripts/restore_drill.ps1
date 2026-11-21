# ServeMyFood PostgreSQL Automated Restore Drill Script (Windows PowerShell)
param(
    [string]$ContainerName = "fusion_postgres",
    [string]$SourceDb = "fusion_saas",
    [string]$DrillDb = "servemyfood_restore_drill",
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackupDir = Join-Path $RepoRoot "backups"

# 1. Run fresh backup first
& (Join-Path $PSScriptRoot "backup_db.ps1") -ContainerName $ContainerName -DbName $SourceDb -DbUser $DbUser -BackupDir $BackupDir
$LatestDump = Get-ChildItem -Path $BackupDir -Filter "servemyfood_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $LatestDump) {
    throw "No backup dump file found in $BackupDir"
}

Write-Output "[Restore Drill] Verifying SHA-256 checksum for $($LatestDump.Name)..."
$ExpectedHash = (Get-Content "$($LatestDump.FullName).sha256").Split(" ")[0].Trim().ToLower()
$ActualHash = (Get-FileHash -Path $LatestDump.FullName -Algorithm SHA256).Hash.ToLower()
if ($ExpectedHash -ne $ActualHash) {
    throw "SHA-256 mismatch! Expected $ExpectedHash, got $ActualHash"
}

Write-Output "[Restore Drill] Preparing ephemeral database $DrillDb..."
docker cp $LatestDump.FullName "${ContainerName}:/tmp/restore_drill.dump"
docker exec $ContainerName psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DrillDb;" | Out-Null
docker exec $ContainerName psql -U $DbUser -d postgres -c "CREATE DATABASE $DrillDb;" | Out-Null

try {
    docker exec $ContainerName pg_restore -U $DbUser -d $DrillDb --no-owner --no-privileges /tmp/restore_drill.dump
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed with exit code $LASTEXITCODE"
    }

    $Query = @"
SELECT
  (SELECT COUNT(*) FROM tenants_tenant) AS tenants,
  (SELECT COUNT(*) FROM tenants_branch) AS branches,
  (SELECT COUNT(*) FROM menu_items) AS menu_items,
  (SELECT COUNT(*) FROM orders_order) AS orders,
  (SELECT COUNT(*) FROM inventory_stockmovement) AS stock_movements,
  (SELECT COUNT(*) FROM (
      SELECT sl.item_id, sl.location_id, sl.quantity - COALESCE(SUM(sm.quantity), 0) AS diff
      FROM inventory_stocklevel sl
      LEFT JOIN inventory_stockmovement sm ON sm.item_id = sl.item_id AND sm.location_id = sl.location_id
      GROUP BY sl.item_id, sl.location_id, sl.quantity
      HAVING sl.quantity - COALESCE(SUM(sm.quantity), 0) <> 0
  ) drift) AS stock_ledger_drifts;
"@
    $Result = docker exec $ContainerName psql -U $DbUser -d $DrillDb -t -A -F "|" -c $Query
    $Parts = $Result.Trim().Split("|")
    $Drifts = [int]$Parts[5]
    Write-Output "[Restore Drill] Verified Counts -> Tenants=$($Parts[0]) Branches=$($Parts[1]) MenuItems=$($Parts[2]) Orders=$($Parts[3]) StockMovements=$($Parts[4]) LedgerDrifts=$Drifts"
    if ($Drifts -ne 0) {
        throw "Stock ledger drift detected in restored database ($Drifts rows)"
    }
    Write-Output "[Restore Drill] PASS: Ephemeral restore and ledger invariant check succeeded."
} finally {
    docker exec $ContainerName psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DrillDb;" | Out-Null
    docker exec $ContainerName rm -f /tmp/restore_drill.dump | Out-Null
}
