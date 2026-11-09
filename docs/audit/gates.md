# Quality Gates Audit

Execution record of all backend and frontend quality gates.

| Gate # | Gate Name | Command / Script | Exit Code | Duration | Outcome / Parsed Metrics | Evidence Raw File |
|---|---|---|---|---|---|---|
| 1 | Backend Pytest with Coverage | $(@{Id=1; Name=Backend Pytest with Coverage; RawFile=backend-pytest.txt; ExitCode=1; Duration=112.70s; Summary=533 passed, 3 failed, Total coverage: 91.68% (required: 90%)}.RawFile) | 1 | 112.70s | 533 passed, 3 failed, Total coverage: 91.68% (required: 90%) | docs/audit/raw/backend-pytest.txt |
| 2 | Backend Ruff Linter | $(@{Id=2; Name=Backend Ruff Linter; RawFile=backend-ruff.txt; ExitCode=1; Duration=0.91s; Summary=}.RawFile) | 1 | 0.91s | 2 lint errors | docs/audit/raw/backend-ruff.txt |
| 3 | Backend Mypy Typecheck | $(@{Id=3; Name=Backend Mypy Typecheck; RawFile=backend-mypy.txt; ExitCode=1; Duration=35.06s; Summary=}.RawFile) | 1 | 35.06s | 4 mypy errors | docs/audit/raw/backend-mypy.txt |
| 4 | Backend Makemigrations Check | $(@{Id=4; Name=Backend Makemigrations Check; RawFile=backend-makemigrations.txt; ExitCode=0; Duration=10.47s; Summary=}.RawFile) | 0 | 10.47s | No pending migrations | docs/audit/raw/backend-makemigrations.txt |
| 5 | Backend Pip Audit | $(@{Id=5; Name=Backend Pip Audit; RawFile=backend-pip-audit.txt; ExitCode=0; Duration=41.74s; Summary=}.RawFile) | 0 | 41.74s | 0 vulnerabilities found | docs/audit/raw/backend-pip-audit.txt |
| 6 | Frontend ESLint | $(@{Id=6; Name=Frontend ESLint; RawFile=frontend-lint.txt; ExitCode=0; Duration=47.62s; Summary=}.RawFile) | 0 | 47.62s | 0 errors, 0 warnings | docs/audit/raw/frontend-lint.txt |
| 7 | Frontend Typecheck (tsc) | $(@{Id=7; Name=Frontend Typecheck (tsc); RawFile=frontend-typecheck.txt; ExitCode=0; Duration=16.09s; Summary=}.RawFile) | 0 | 16.09s | 0 TypeScript errors | docs/audit/raw/frontend-typecheck.txt |
| 8 | Frontend Vitest with Coverage | $(@{Id=8; Name=Frontend Vitest with Coverage; RawFile=frontend-vitest.txt; ExitCode=1; Duration=156.22s; Summary=}.RawFile) | 1 | 156.22s | Tests  5 failed  | docs/audit/raw/frontend-vitest.txt |
| 9 | Frontend Production Build | $(@{Id=9; Name=Frontend Production Build; RawFile=frontend-build.txt; ExitCode=0; Duration=65.58s; Summary=}.RawFile) | 0 | 65.58s | Build succeeded in 23.54s | docs/audit/raw/frontend-build.txt |
| 10 | Frontend API Types Drift | $(@{Id=10; Name=Frontend API Types Drift; RawFile=frontend-api-types.txt; ExitCode=0; Duration=10.86s; Summary=}.RawFile) | 0 | 10.86s | In sync (0 drift against openapi.json) | docs/audit/raw/frontend-api-types.txt |
| 11 | Frontend NPM Audit (High/Critical) | $(@{Id=11; Name=Frontend NPM Audit (High/Critical); RawFile=frontend-npm-audit.txt; ExitCode=1; Duration=23.5s; Summary=}.RawFile) | 1 | 23.5s | 16 vulnerabilities | docs/audit/raw/frontend-npm-audit.txt |
| 12 | Playwright E2E Test List | $(@{Id=12; Name=Playwright E2E Test List; RawFile=playwright-list.txt; ExitCode=0; Duration=5.75s; Summary=}.RawFile) | 0 | 5.75s | 144 E2E tests listed | docs/audit/raw/playwright-list.txt |
| 13 | Playwright E2E Test Run | $(@{Id=13; Name=Playwright E2E Test Run; RawFile=playwright-run.txt; ExitCode=1; Duration=1045.98s; Summary=}.RawFile) | 1 | 1045.98s | 130 passed  | docs/audit/raw/playwright-run.txt |

## Stubs in E2E Tests (page.route)

List of all server network mocks identified in rontend/e2e: documented in docs/audit/raw/e2e-stubs.txt.
