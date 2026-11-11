# 50-employee pilot capacity

The number of employee accounts is not a concurrency or latency SLA. Default queues have two workers, each handling one provider stage at a time; report-text is consumed before default. Increase WORKFORCE_QUEUE_WORKERS only after reviewing host resources and provider limits. Do not use real employee data or paid calls for the synthetic probe.

After backend tests have migrated PostgreSQL workforce_testing, run `./scripts/verify-capacity.ps1` on this Windows development computer. Never run it alongside another database test runner or backup probe. It fixes APP_ENV=testing and the database name, sets Demo with an empty API key, and uses Redis DB 3/cache 4 with a fresh capacity_ prefix. Guards reject other environments before seeding. It seeds 50 synthetic employees across two tenants and 50 dummy audio-placeholder reports in text mode, adds duplicate and forged-tenant deliveries, starts two real Redis worker subprocesses and checks readiness, output ownership and empty queues. It stops its own workers and deletes only its generated fixtures/queues. CI runs the same PHP probe after its database suite.

Observed local simulation on 2026-11-08: 50 ready reports, 100 stored text outputs, zero cross-tenant outputs, zero remaining jobs and zero new failed jobs, queue drain 21.63 seconds. This uses Demo, not speech decoding, browser uploads, real OpenAI latency, production database contention or 50 simultaneous phones. Do not market this number as production throughput. One developer-host media test timed out under heavy concurrent checks and passed on a quieter rerun; host load remains relevant.

Provider smoke, synthetic text only: the same short Arabic source took 9136 ms before translation optimization and 4998 ms afterward. Hindi, Urdu and English samples took 1619/2030/2768 ms afterward. Four quantity/negation checks passed. One before/after sample is not a percentile benchmark or an end-to-end speech accuracy guarantee. gpt-transcribe was not replaced. Text mode reduces audio-plus-three-image requests from six to two; images remain private evidence without AI descriptions.

Before a real 50-employee launch:

- Use stable HTTPS and a production web runtime/hosting plan. Current artisan development serving and expiring Quick Tunnel are development preview mechanisms. A hostname renewal cannot update installed PWA origins or old QR links.
- Measure actual upload/normalization and provider p50/p95, queue age, retries/429s and error rate with approved synthetic media in employee languages. Keep provider/project data controls and quotas explicit.
- Size storage and retention from measured media sizes, including retired/withdrawn evidence and backups. The existing defaults are 1000 reports/day, 2048 MB retained media and 90 days; no existing tenant quota is silently increased here. As an example only, 50 employees ×10 reports/day ×0.75 MB ×90 days is 33750 MB before backups. A 2 GB quota cannot hold that example workload.
- Keep bounded worker concurrency, PostgreSQL/Redis health monitoring and existing recovery/retention scheduling. Do not flush shared caches/queues or replay historical reports during rollout.

Operational source flags: WORKFORCE_REPORT_ANALYSIS=text for new reports (full is a compatibility option), OPENAI_TRANSLATION_EFFORT=minimal for the default compatible model, WORKFORCE_QUEUE_WORKERS=2 as the Compose default. Recreate worker/web services after configuration changes while preserving the active preview origin/proxy. Never copy credentials or employee media into this public repository.
