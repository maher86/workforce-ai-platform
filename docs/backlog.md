# Delivery backlog

The identifiers below are planning IDs, not GitHub issue numbers. GitHub issues #1 through #13 correspond to T01 through T13. Each item maps to a small issue and PR. No production deployment or merge is implied by implementation approval.

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| T01 | Local runtime readiness | none | Docker Linux server reachable, disposable container succeeds, gh access verified, reproducible commands recorded. |
| T02 | Governance and architecture | none | AGENTS, ADRs, scoped skills, issue/PR templates, handoff and approved MVP scope committed for review. |
| T03 | Laravel React/TypeScript scaffold | T01,T02 | App and login page load; frontend build and initial backend tests pass. |
| T04 | Compose and CI | T03 | PostgreSQL/Redis app, worker and scheduler start; fresh-checkout setup documented; CI passes with synthetic inputs only. |
| T05 | Tenants, memberships and roles | T04 | Owner/manager/employee policies and relational boundaries work; two-tenant access/association tests pass. |
| T06 | Employee activation and recovery | T05 | Manager-created employee profiles; expiring one-use QR/link; no employee email/password; revocable persistent device access; manager recovery and disabled-membership denial tested. |
| T07 | Report intake and private media | T05 | Text/audio/images/combinations accepted without task; file limits and private cross-tenant denial tested. |
| T08 | Async pipeline with fake AI | T07 | State transitions, bounded retries, idempotency, failed state and manual retry verified. |
| T09 | OpenAI integration and fidelity | T08 | Opt-in synthetic multilingual evaluation verifies source transcript, faithful translation, grounded schema and uncertain quantities. |
| T10 | Manager review and CSV | T09 | Filters, evidence, revision history, approval and tenant-scoped export tested; spreadsheet formula injection prevented. |
| T11 | Optional work management | T07 | Same-tenant projects/tasks can be linked; unassigned submission remains valid. |
| T12 | Mobile PWA | T07 | Manifest/install behavior, microphone permissions, upload fallback and connectivity errors verified; sensitive responses not cached. |
| T13 | Pilot operations | T06,T10,T11,T12 | E2E flow, quotas, retention/deletion, backup restore, health checks and staging deployment verified. |

Critical path: environment -> scaffold/runtime/CI -> tenancy -> intake -> fake pipeline -> real AI -> review -> pilot checks. Add supporting tasks only when needed; retain small reviewable PRs.

## Implementation checkpoint (2026-11-06)

T01-T04 are merged to dev through PR #14. T05-T06 are implemented in pending PR #15. The stacked codex/7-reporting-mvp branch implements T07/T08/T10/T11 and supporting T09/T12/T13 code. Local verification: 97 tests / 399 assertions, PHPStan, frontend types/build and synthetic HTTPS end-to-end passed. T09 remains open for real multilingual speech/image evaluation; T12 for physical devices/usability; T13 for stable production runtime, backup policy and pilot acceptance. T10 can be tested with deterministic AI before T09 live acceptance; production release still depends on it. See docs/product/mvp-coverage.ar.md for every requirement and remaining gate.
