# Delivery and public-repository safety

Use dev for integration and staging, main for production releases. Branch from dev into codex/<issue>-<slug>, open a PR to dev and link the issue. The initial project-foundation branch was created before issue numbering. Do not auto-merge. Release through a dev-to-main PR; hotfixes must be reconciled with dev.

Protect both branches against direct/force pushes and require CI and resolved discussions. Require independent review when a second reviewer is available. Apply settings only after the required check names exist. Issues and PRs must contain synthetic examples, never employee data.

CI should run backend tests with PostgreSQL/Redis, formatting/static analysis, frontend type/lint/build, focused browser checks and secret/dependency scanning. Real OpenAI calls and production secrets must not be available in PR jobs. Pin actions to verified commit SHAs and use minimal GITHUB_TOKEN permissions. Never execute untrusted PR code in a privileged pull_request_target job.

Build an immutable application image. Staging deployment follows dev when configured; production requires an approved main release/environment. Use TLS, off-host backups with restore tests, health checks, private storage and explicit migration/rollback instructions. Prefer additive compatible migrations; image rollback does not reverse database writes. Restart queue workers and run only one effective scheduler or use distributed overlap locks. Do not expose database/Redis ports publicly.

Definition of done: issue criteria, appropriate checks, tenant/security review, documented operations/migrations, no sensitive artifacts and a reviewed diff. CI protection setup and an actual successful CI run remain separate from authoring workflow YAML.
