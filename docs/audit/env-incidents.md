# Environment Incidents Log

| Date / Time (IST) | Incident | Impact | Resolution |
| :--- | :--- | :--- | :--- |
| 2026-11-14 ~21:30 – 2026-11-15 08:38 | Host/agent server restarted overnight | Stopped in-progress `scripts/verify_all.ps1` (`task-29933`) | Restarted verification after checking `git status` and `git diff --stat`. |
| 2026-11-15 ~09:40 – 10:06 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-29967`) mid-Gate 16 | Resumed and isolated Slow 4G CDP throttle in `public-qr-ordering.spec.ts`. |
| 2026-11-15 ~11:50 – 12:03 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30027`) mid-Gate 16 | Restarted Vite & verification. |
| 2026-11-15 ~13:30 – 14:00 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30039`) at 114/154 E2E tests | Disabled AC standby/monitor sleep (`powercfg /change standby-timeout-ac 0`) and stabilized E2E isolation. |
| 2026-11-15 ~15:11 – 15:25 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30362`) during Gate 1 (`backend-pytest.txt`) | Checked `git status` & `git diff --stat`, logged incident, and rerunning `verify_all.ps1` from the start. |
| 2026-11-15 16:04 | Tag `v0.9.0` audit check | `git show v0.9.0:docs/evidence/SUMMARY.txt` shows 16/16 gates PASS, but the 3 extra metric lines (`Image Processing & Safety`, `Waiter Availability Isolation`, `Tax Claim Policy`) were static text, not parsed checks (`v0.9.0` is not a fully verified release). | Kept `v0.9.0` untouched; replaced static lines in `scripts/verify_all.ps1` with real parsed checks. |

## 2026-11-15 18:00-18:43 +05:30 - verify_all.ps1 interrupted by agent server restart
- Run started at 18:00:49 on commit 29d0e75 (clean code tree). At 13:13Z (18:43 IST) the agent host restarted and stopped all background tasks, including verify_all.ps1.
- SUMMARY.txt on disk is still the older 15:25 run; evidence files from the interrupted run are partial and are NOT used.
- Docker containers stayed up (10 h, healthy). Power standby/monitor/hibernate timeouts set to 0 (AC) before rerun.
- Action: rerun verify_all.ps1 from gate 1 on the same commit; no gate results from the interrupted run are reused.
