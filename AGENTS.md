# Engineering instructions

## Product invariants
- This public repository must contain only source, synthetic fixtures and safe example configuration. Never commit secrets, employee media, customer data or production configuration.
- Build the SaaS/PWA channel first. WhatsApp is deferred. Reporting application services must not depend on HTTP, Inertia or provider payloads.
- Reports accept text-only or one audio recording with optional text/images. Since the owner's 2026-11-07 clarification, report images require audio; image-only and image+text without audio are rejected by the shared action. Task/project associations remain optional. Profile photos are separate from report evidence.
- Employees do not self-register or type passwords/email. Managers provision profiles and one-use QR/link activation; subsequent device access is revocable and bounded. Keep employee UI separate, icon-led and assisted by audio; see ADR 0004. Never put persistent credentials in PWA URLs or external QR services.
- Preserve source-language transcripts separately from faithful English translations and generated reports. Unknown quantities stay unknown. Images cannot establish unverified completion.
- Every tenant-owned query, policy, job, cache key, export and file access must enforce tenant membership. Test cross-tenant denial.
- Vehicles are optional report subjects, never fixed employee groups. Multiple employees may report on one car; one employee may report on many. Show reporting/approval activity as measured counts, never infer productivity, attendance, hours or verified completion from counts, photos or audio duration. Day boundaries use Asia/Dubai for the current product.
- Service facts are explicit manager confirmations in separate append-only revisions. Preserve unknown rework, require a source/note and a reason for yes, and never overwrite AI evidence. Service metrics use latest versions with coverage and assessed denominators; documented intervals may overlap and do not establish payroll hours or unique completed operations.

## Architecture and workflow
- Read `docs/architecture/overview.md` and relevant ADRs before changing boundaries.
- Use Laravel, React/TypeScript, PostgreSQL, Redis and Docker Compose. No n8n, Kubernetes or premature microservices.
- Track work in GitHub Issues; use short `codex/<issue>-<slug>` branches from `dev`, with PRs to `dev`. The initial foundation branch predates issue numbering.
- Keep `main` for releases. Do not merge or deploy without authorization for that action.
- Run documented checks appropriate to the change. Report failures and untested assumptions accurately; never claim CI or containers passed without evidence.
- Use synthetic AI fixtures in CI. Real provider evaluation is explicit and uses local credentials only.
- Use `.agents/skills/tenant-isolation-review` for tenancy review and `.agents/skills/report-fidelity-review` for AI-report review.
- At a session boundary, update `docs/handoffs/current.md` with branch, work, actual checks, blockers and next steps; omit secrets and private data.

## Definition of done
Issue acceptance criteria satisfied; relevant tests and CI pass; authorization and tenant boundaries reviewed; migrations and operational effects documented; no sensitive content in the diff. A draft or blocked task is not complete.

## Runtime commands
- Setup: ./scripts/dev.ps1 Setup
- Validate: ./scripts/dev.ps1 Check
- Status/stop: ./scripts/dev.ps1 Status or Stop
- Backend tests use PostgreSQL workforce_testing and require Redis; never point them at a customer database.
- Run only one database test runner or backup-restore probe against workforce_testing at a time. Parallel runners can race migrations and invalidate results. Filesystem/type checks may run independently.
