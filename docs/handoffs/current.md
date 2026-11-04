# Current handoff

Date: 2026-11-04 (Asia/Dubai).
Branch: codex/2-project-foundation, based on dev at 187d59f.
Governance commit: 0887534; inspect Git HEAD for the subsequent scaffold commit.

The user approved implementation of the Arabic plan. Issues #1-#13 map to T01-T13. Do not merge or deploy production without authorization for those actions. This branch implements the T01-T04 foundation; tenancy/reporting features are still pending.

Verified at this checkpoint:
- Docker Linux engine and disposable hello-world; application image built (PHP 8.4.27, Node 22, Composer, npm/npx).
- Compose: app, worker, scheduler, PostgreSQL, Redis and Mailpit running; app/PostgreSQL/Redis/Mailpit health checks passed.
- Separate workforce and workforce_testing databases; Redis PONG; app migrations applied to local workforce only.
- GET /login: HTTP 200, Inertia component auth/login; built JavaScript: HTTP 200. Native browser automation could not initialize its sandbox, so browser E2E is unverified.
- Composer validate --strict and check-platform-reqs; frontend build, format/lint and TypeScript; Pint 55 files; both project skills' bundled validators passed.
- npm installation audit reported zero vulnerabilities. A full post-commit secret scan is required before public push.

In progress: Larastan (512 MB, two processes), PHPUnit including real Redis worker probe, final dependency audits and GitHub CI. A prior Larastan attempt exhausted the default 128 MB; do not treat that attempt as a code-analysis pass. Consult the PR for current results and update this handoff at completion.

Resource notes: host free RAM fell to about 569 MB during checks. Project-only Node/concurrency limits and four development web workers were added; SSR is disabled because no SSR server is running. Existing unrelated containers and global WSL settings were not changed. This project uses loopback web 18000 and mail 18025 after avoiding an existing application's 8025 listener. See development runbook for the initial vendor-volume label warning.

Next: complete checks, create/update foundation PR to dev, configure main/dev protection using actual CI check names, and proceed to T05 tenant isolation after foundation review. Do not use this scaffold with employee/customer data. All fixtures and database state are synthetic. Local .env and generated dependencies/assets are ignored.