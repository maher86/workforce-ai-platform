# Current handoff

Date: 2026-11-04 (Asia/Dubai).
Branch: codex/2-project-foundation, based on dev at 187d59f.
Application checkpoint: 239a818; inspect Git HEAD for later documentation-only updates.
PR: https://github.com/maher86/workforce-ai-platform/pull/14 (base dev).
Issues #1-#13 correspond to T01-T13 in docs/backlog.md.

## Delivered foundation (T01-T04)
- Docker Desktop Linux engine started and verified with hello-world; container image includes PHP 8.4.27, Composer, Node 22 and npm/npx. No host PHP or Composer upgrade was required.
- Laravel 13 + React/TypeScript/Inertia scaffold; auth, email verification, password recovery and optional two-factor controls from the official starter. No reporting/tenancy features are implemented yet.
- Compose web/worker/scheduler/PostgreSQL/Redis/Mailpit; workforce and workforce_testing databases; source-controlled example configuration; ignored local .env and generated dependencies/assets.
- AGENTS, ADRs, two validated project skills, backlog, issue/PR templates, runbooks and CI. CI job names are Application checks and Secret scan.
- main/dev protection configured: PR required, both checks required, strict status checks, resolved conversations, no force-push/deletion, admin enforcement. Independent approvals currently zero for the single-maintainer setup; increase when a second reviewer is available.

## Actual verification
- Composer validate --strict and platform requirements passed; PHP minimum/platform is 8.4.1 so patched Symfony 8.1 components can resolve on runtime 8.4.27.
- Frontend build, formatting/lint and TypeScript passed; Pint 55 PHP files; Larastan level 7 passed using 512 MB and two processes.
- PHPUnit: 43 passed, 137 assertions after security dependency updates. Includes PostgreSQL target, Redis cache and a serialized Redis worker job.
- Negative guard probe rejected application database settings before migrations. PHPUnit now forces both env and server values; tests/TestCase.php fails before RefreshDatabase unless testing/local PostgreSQL workforce_testing is selected. An initial misconfiguration used the newly created local app database; it was corrected before any employee/customer data was introduced.
- Composer audit and npm audit reported no vulnerabilities after remediation. Public-push Git history secret scan passed; GitHub Secret scan independently passed on the prior checkpoint.
- GET /login returned 200 with auth/login; built JavaScript returned 200. Web, PostgreSQL, Redis and Mailpit passed health checks; worker/scheduler running.
- Latest GitHub Actions result is authoritative on PR #14. CI runs again after each PR update; never assume an older run covers current HEAD.

## Operational notes and limits
Local URLs: http://localhost:18000/login and mail http://localhost:18025 . The existing unrelated application used 8025; its containers were not changed. Four development PHP workers and project-only Node/concurrency limits mitigate low host memory (569 MB free was observed). SSR is off because no SSR service is deployed. No global WSL configuration was changed. The initial vendor volume may show a non-fatal Compose ownership-label warning; do not delete volumes to suppress it.

Native browser automation could not initialize its sandbox; browser E2E remains unverified. First-channel PWA/reporting/AI/tenancy and pilot operations remain T05-T13. Do not use this scaffold with real employee data. Production host/domain/email/storage and deployment approval remain future decisions.

## Next action
Review the current PR and its latest checks. Do not merge or deploy production without authorization for those actions. After foundation review/merge, start #5 (T05) on a short branch from updated dev: tenant memberships/roles, policies, relational constraints and cross-tenant denial tests. Reporting actions must remain channel-independent, and task/project associations optional. No WhatsApp implementation now.