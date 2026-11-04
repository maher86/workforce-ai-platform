# Development

## Baseline inspection (2026-11-04)
Repository initially contained only README and .gitignore. dev/main pointed to 187d59f. GitHub authentication and ADMIN access were verified. Docker client 25.0.2 and Compose 2.24.3 were installed, but Linux engine endpoints were unavailable. Local PHP 8.0.30 has an Xdebug warning; Composer is absent from PATH. Use containerized tooling rather than the XAMPP PHP installation.

Git may report ownership mismatch under the sandbox account. Use command-scoped `git -c safe.directory=C:/Projects/workforce-ai-platform ...` after verifying this exact workspace; do not disable the safety check globally.

GitHub CLI exists at `C:/Program Files/GitHub CLI/gh.exe`; invoke its full path when PATH does not resolve `gh`. Do not print authentication tokens.

## Runtime readiness
Start Docker Desktop on this computer, then run `docker --context desktop-linux version` and `docker --context desktop-linux info`. Client version output alone is not a successful engine test. Verify a disposable Linux container before application setup. Do not silently change the user's global Docker context.

Application setup/check commands will be documented alongside the runnable scaffold. No application runtime has been verified merely by adding this runbook.

## Application setup (PowerShell)

Prerequisite: running Docker Desktop Linux engine and network access for the initial image/dependency downloads. No host PHP/Composer/Node installation is required.

```powershell
./scripts/dev.ps1 Setup
./scripts/dev.ps1 Status
./scripts/dev.ps1 Check
./scripts/dev.ps1 Stop
```

Setup preserves an existing .env and generates APP_KEY only when empty. It installs locked dependencies, builds frontend assets, migrates the local application database and starts app/worker/scheduler. Open http://localhost:8000 and the local mail viewer http://localhost:8025 . These ports bind only to loopback. The PHP development server and example credentials are for local development only.

PostgreSQL initializes workforce and workforce_testing in the project volume. Tests force workforce_testing; they must never run on employee/customer databases. The initialization SQL runs only when PostgreSQL's data volume is empty. If upgrading an existing local volume without workforce_testing, explicitly create that database with the workforce owner; do not delete volumes to fix it. Stop retains all volumes.

To use Vite HMR after setup:

```powershell
docker --context desktop-linux compose --profile vite up -d node
```

Check covers Composer metadata, frontend build/check/types, Pint, Larastan, PostgreSQL/Redis tests and dependency audits. CI separately scans Git history for secrets. Browser E2E and real AI evaluations arrive with their corresponding feature tasks. The foundation is not a tenant-safe pilot until T05-T13 acceptance criteria pass.

Queue worker timeout is 120 seconds, below Redis retry_after 180 seconds; update them together when introducing longer AI jobs. Stop grace exceeds job timeout. Persistent Redis uses noeviction; monitor memory before pilot release.
