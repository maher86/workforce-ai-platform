# Reporting verification and operations

Use synthetic content until pilot gates in docs/product/mvp-coverage.ar.md pass. Product update 2026-11-07: images require audio, even with text; audio-only/text-only remain supported. Employee profile photos are separate. Current acceptance script: docs/product/employee-workflow.ar.md.

## Try the workflow

1. Local verified manager: /dashboard -> select workspace -> Reports/projects. Create an optional project/task if useful; reports do not require either.
2. Activate a synthetic employee on a different browser/phone with a new QR. On /employee, record then stop or upload an audio file, add up to three photos and press Send. Text/work associations are optional under the collapsed section. Do not close the page until acknowledgement. In-memory drafts are not durable offline storage.
3. Manager opens the new report, plays private evidence and reviews source transcription, English translation and unverified image observations separately. Demo mode intentionally shows unavailable placeholder analysis with no fabricated facts.
4. Ready/failed reports accept a human English revision with reason and optimistic version check. A manual revision does not change failed processing into successful AI. Retrying requires fresh review; old revisions remain.
5. Test date/employee/state filters and CSV. Verify another tenant and another employee in the same tenant cannot read private reports/media. Owners can delete a report after an explicit product confirmation.

Limits: one audio, three images, each at most 12MB; decoded audio at most about three minutes, image at most 20MP and resized to a 2560-pixel bound. Audio-only MP3/M4A/WAV/WebM/Ogg containers are normalized to M4A; video streams are rejected. JPEG/PNG/WebP images become JPEG. Default tenant limits are 1000 reports/day, 2048MB storage and 90-day retention, administered by a trusted operator rather than exposed as customer billing controls.

## AI configuration

Default WORKFORCE_AI_PROVIDER=demo is honest simulation, not English transcription/analysis. For real operation, the operator adds OPENAI_API_KEY in the ignored local apps/platform/.env, selects WORKFORCE_AI_PROVIDER=openai and compatible model IDs, then recreates app/worker/scheduler/preview services while preserving temporary preview variables as documented in phone-preview.md. Queue workers must restart after provider/config changes. Never put keys in a browser, PR, issue, log or chat.

After explicit API-spend approval, `php artisan ai:evaluate --run` makes four paid requests with built-in synthetic Arabic/Hindi/Urdu/English text. It checks basic quantity/negation preservation only. It does not establish speech recognition accuracy, image accuracy or business readiness. Add approved multilingual speech/image fixtures and human review before pilot use. Do not run it in CI. Stored model IDs/prompts/schemas and uncertainties aid review but do not prove facts.

## Recovery and deletion

- reports:recover runs each minute; it recovers stale submitted/processing rows in batches of 100. It never automatically retries failed rows indefinitely. Manager retry is audited.
- reports:purge defaults to dry run; --apply removes expired reports and private media, at most 100 per tenant per invocation. Scheduler applies it daily at 02:00 UTC. Schedule additional batches for a retention backlog.
- reports:prune-orphans defaults to dry run; --apply deletes only old generated unreferenced files (older than a day), in batches of 1000. Scheduled at 03:00 UTC. Referenced/recent media are preserved.
- schedule:list shows all three tasks. Keep worker and scheduler services running. Inspect failure codes/IDs without copying private evidence to logs/issues.
- Run only one test/backup probe against workforce_testing at a time. Test database guard rejects normal application database settings before migrations.

## Backup/restore and deployment gate

`./scripts/verify-backup.ps1` dumps workforce_testing, restores into a generated workforce_restore_* database, verifies a marker and separately verifies a synthetic file archive. It removes only its generated database/table/temp files. Never redirect it to workforce or run it concurrently with DB tests. It is an isolated mechanism check, not a customer backup policy.

Production backup must capture the application database and private report storage at a consistent checkpoint, keep application encryption keys separately, encrypt offsite copies, enforce destination access/retention and prove restoration on a separate host. Select destinations with the owner before configuring credentials. No production backup data/configuration is committed here.

The current image and Laravel development server support local/temporary HTTPS evaluation. Do not promote that server or ephemeral hostname into production. A deployment-specific runtime, stable HTTPS domain, restricted database roles, real mail/storage, secret injection, health/queue monitoring, measured load test, backup restore and explicit release approval remain required. Use a release PR from dev to main after the dependent feature PRs are approved; there is no authorized production deployment in this change.
