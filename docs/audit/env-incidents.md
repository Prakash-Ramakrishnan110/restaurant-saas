# Environment Incidents Log

| Date / Time (IST) | Incident | Impact | Resolution |
| :--- | :--- | :--- | :--- |
| 2026-11-14 ~21:30 – 2026-11-15 08:38 | Host/agent server restarted overnight | Stopped in-progress `scripts/verify_all.ps1` (`task-29933`) | Restarted verification after checking `git status` and `git diff --stat`. |
| 2026-11-15 ~09:40 – 10:06 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-29967`) mid-Gate 16 | Resumed and isolated Slow 4G CDP throttle in `public-qr-ordering.spec.ts`. |
| 2026-11-15 ~11:50 – 12:03 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30027`) mid-Gate 16 | Restarted Vite & verification. |
| 2026-11-15 ~13:30 – 14:00 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30039`) at 114/154 E2E tests | Disabled AC standby/monitor sleep (`powercfg /change standby-timeout-ac 0`) and stabilized E2E isolation. |
| 2026-11-15 ~15:11 – 15:25 | Host/agent server restarted | Stopped `scripts/verify_all.ps1` (`task-30362`) during Gate 1 (`backend-pytest.txt`) | Checked `git status` & `git diff --stat`, logged incident, and rerunning `verify_all.ps1` from the start. |
