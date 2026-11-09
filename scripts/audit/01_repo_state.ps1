# scripts/audit/01_repo_state.ps1
$outFile = "docs/audit/raw/git.txt"

& {
    Write-Output "=== 1. CURRENT BRANCH ==="
    git branch --show-current
    Write-Output ""

    Write-Output "=== 2. GIT STATUS ==="
    git status
    Write-Output ""

    Write-Output "=== 3. LAST 20 COMMITS ==="
    git log -n 20 --oneline --decorate
    Write-Output ""

    Write-Output "=== 4. TAGS ==="
    git tag -n
    Write-Output ""

    Write-Output "=== 5. COMMITS NOT PUSHED ==="
    git log origin/main..HEAD --oneline 2>&1
    Write-Output ""

    Write-Output "=== 6. TOOL VERSIONS ==="
    Write-Output "Node: $(node -v 2>&1)"
    Write-Output "NPM: $(npm -v 2>&1)"
    Write-Output "Python: $(python --version 2>&1)"
    Write-Output "UV: $(uv --version 2>&1)"
    Write-Output ""

    Write-Output "=== 7. DOCKER COMPOSE PS ==="
    docker compose ps 2>&1
    Write-Output ""
} | Tee-Object -FilePath $outFile
