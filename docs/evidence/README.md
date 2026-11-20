# Verification Evidence & Clean-Tree Release Workflow

`scripts/verify_all.ps1` writes all gate logs and `SUMMARY.txt` under `docs/evidence/`. Because those files are tracked in git, running `verify_all.ps1` modifies `docs/evidence/*`.

## Workflow
1. **Clean code tree check**: `scripts/verify_all.ps1` checks `git status --porcelain` excluding `docs/evidence/` and reports `Working Tree: Clean (code)` only when no code or non-evidence files are modified or untracked.
2. **Run verification**: Run `powershell -ExecutionPolicy Bypass -File scripts/verify_all.ps1` on a clean code commit.
3. **Commit evidence**: After a green run, commit the updated `docs/evidence/` files in their own commit named `evidence: run <YYYY-MM-DD>`.
4. **Tag the code commit**: Release tags (e.g. `v1.1.0-qr-ordering`) point at the verified code commit.
