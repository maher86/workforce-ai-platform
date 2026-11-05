# Current handoff

Date: 2026-11-06 (Asia/Dubai).
Branch: codex/7-reporting-mvp. Stacked on f1cbb9f of codex/5-employee-device-onboarding, whose PR #15 remains open to dev. PR #14 was explicitly authorized and merged to dev; main is unchanged. No authorization to merge the new PRs or deploy production. Inspect GitHub for the final reporting PR and exact HEAD checks.

## Delivered for review
- Existing QR/device onboarding remains: manager-created profiles, no employee signup/email/password, one-use expiring links, revocable bounded device cookies, separate employee surface. User confirmed Android icon installation, not all hardware acceptance cases.
- Working channel-independent SubmitReport accepts optional text, one audio and up to three images with no required project/task. FFmpeg validates/normalizes private media; 12MB/input, about three minutes audio, 20MP image limit. Tenant quotas, payload-bound UUID idempotency and composite database associations protect intake.
- After-commit event and Redis jobs process one bounded stage each. Explicit environment/tenant/report locks, active-membership revalidation, immutable persisted outputs, redacted failures, retries and stale-job recovery. Transcription, English translation, unverified image observations and structured claims remain distinct. Image-only policy cannot invent quantities/completion.
- OpenAI adapter implements transcription and strict Responses contracts with store:false. Default demo mode clearly marks unavailable analysis. No real API requests made: local key was absent and explicit synthetic paid-evaluation question is awaiting user response. Never infer approval from a preselected choice. ai:evaluate --run tests four synthetic text cases only; live multilingual speech/image evaluation and human assessment remain.
- Manager reports: tenant-scoped filters/private playback, evidence/provenance, optimistic human revisions/approval, manual review even after AI failure, audited retry and CSV formula protection. Owners can delete reports, grant/revoke manager membership using their password, and re-enable employees with fresh QR. Optional projects/tasks can be created/closed. Associated account self-deletion is blocked.
- Icon-led employee recording/camera/upload with in-memory retry, polling and permission/error guidance. No sensitive offline cache or durable offline draft. Actual phone mic/camera/background/denied-permission checks remain.
- Scheduled retention/orphan cleanup, audited metadata, isolated backup/restore probe and CI FFmpeg installation. See ADR 0005, docs/runbooks/reporting.md and Arabic requirement matrix docs/product/mvp-coverage.ar.md.

## Actual verification
- Final sequential local run passed: 97 tests / 399 assertions, Pint 100 files, PHPStan level 7 (79 files), frontend format/lint (69 linted files), TypeScript and production asset build.
- Tests include cross-tenant and coworker denial, forged job/work IDs, quotas/idempotency, real FFmpeg browser WebM decoding, private media, cached pipeline stages/recovery/retry, immutable review/version conflict, retention/orphans, owner roles, CSV formulas and deterministic fidelity/API-contract cases. Test environment forces demo and blank API key; guarded PostgreSQL workforce_testing only.
- An earlier concurrent database-test invocation raced migrations and failed. Corrected a multipart mock assertion separately, added the one-runner rule to AGENTS, then ran the entire suite sequentially to the passing result above. Do not run another DB test or backup probe concurrently against workforce_testing.
- Full HTTPS synthetic probe passed activation, actual WebM+image multipart intake, idempotent repeat, real Redis worker four persisted stages, authorized media/range playback and human review; probe data removed. Repeated final probe status is recorded in the session/PR. No actual microphone/camera permission or ambient recording was performed.
- scripts/verify-backup.ps1 passed synthetic PostgreSQL dump/restore and media archive roundtrip. Only fixed workforce_testing and generated restore DB/temp files; not a production backup policy.
- Composer audit and npm production audit: zero advisories. Docker image rebuilt with FFmpeg; additive migrations applied, no reset of application database. Public secret scan/CI must be inspected for the final committed HEAD, not inferred from prior PR #15.

## Runtime and safety
- Local app http://localhost:18000/dashboard and mail http://localhost:18025. Docker context desktop-linux. Do not touch unrelated sortlot containers or user-created data/forms.
- User-authorized temporary Cloudflare HTTPS preview continues. Exact current URL is only in ignored .preview/runtime.json; no temporary URLs, credentials, employee data or generated media in Git. Reissue QR if tunnel hostname changes. Existing Android icon tied to that hostname is not a durable production install.
- Preserve --no-reload on Laravel development server: reload discards container environment, breaking preview URL/debug/Secure-session overrides. Preview has debug off, Secure distinct session cookie and exact proxy trust. Do not recreate app/preview without preserving preview environment; use scripts/preview.ps1 Start when appropriate.
- worker/scheduler must restart after code/provider changes. Current provider is demo. Never globally enable real AI against queued user content without approval/data-handling review; use approved synthetic inputs first.

## Next gates
1. Reporting PR targets the onboarding branch so it excludes PR #15 changes; CI permits codex/** bases. After authorized onboarding squash merge, rebase reporting changes with --onto origin/dev f1cbb9f, then retarget dev and rerun checks. Never merge either without user authorization.
2. User supplies ignored local OpenAI key and explicit limited paid synthetic approval; evaluate real multilingual speech/images with human review. Never ask them to paste keys in chat.
3. Actual Android/iPhone and low-literacy usability checks, including recording, camera, permissions, connectivity and revocation. Dedicated employee phone assumed; shared-phone identity switching deferred.
4. Stable domain/HTTPS, production runtime, real mail/private storage, restricted DB roles, encrypted offsite database+media backups with restoration, monitoring/load verification, provider retention/cost policy and explicit release/deployment approval. Current development server/tunnel is not production.
5. WhatsApp remains deferred; billing automation, advanced analytics and full offline synchronization remain outside MVP. T07/T08/T10/T11 code is ready for review; T09 live evaluation, T12 physical acceptance and T13 production/pilot acceptance remain open.
