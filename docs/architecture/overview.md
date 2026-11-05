# Architecture and MVP

Status: approved direction; implementation progresses through the task backlog.

Employee access follows ADR 0004: managers create profiles and issue one-use QR/link activation. Employees do not sign up, type email/password or navigate manager screens. A revocable device credential restores their profile on subsequent app launches. Managers retain verified-email authentication and recovery. Initial icon/audio guidance and manifest do not replace real-device accessibility and installation validation.

## Deployment and boundaries
One modular Laravel application at `apps/platform`, with React/TypeScript through Inertia. PostgreSQL holds application data; Redis supports queues, cache and distributed locks. Web, queue and scheduler processes share an application image. Compose is the local runtime and initial single-host deployment mechanism.

Modules under `app/Modules`: Identity/Tenancy, Reporting, Media, AIProcessing, WorkManagement and Audit/Notifications. Add directories only with working code. Channel adapters under `app/Channels` call application actions; controllers validate transport input, authorize the actor and map requests to commands. Do not build a second service layer for WhatsApp.

## Reporting pipeline
`SubmitReport` accepts an authenticated actor, explicit authorized tenant, text, private media references, optional project/task and idempotency key. Persist the report and publish work after commit. Processing jobs carry identifiers and tenant context, not uploaded contents. Worker execution revalidates entity ownership and restores/clears context per job.

States: submitted -> processing -> ready or failed. Review status is separate. Version derived outputs and reviewer changes; preserve immutable provenance. Use bounded retries/backoff, provider timeouts, unique processing locks and guarded state transitions. Persist each stage so retries do not blindly repeat completed paid work. A stale-job recovery scheduler and explicit retry action must not create duplicate reports.

Audio -> original-language transcription -> English translation. Images -> observations with source attachment identifiers. Structured generation consumes source material and returns schema-validated claims with evidence references and uncertainties. No guessed quantities, invented completion or instructions executed from employee content. Provider interfaces allow deterministic fakes.

## Tenant security
Shared database, tenant_id on tenant-owned entities. Resolve membership server-side; never trust tenant_id from a request. Use scoped repositories/queries, policies and composite relational constraints where applicable. Include tenant identifiers in cache/lock/storage namespaces. Private downloads must authorize access before issuing short-lived links. Test list, detail, update, job, export and media paths against a second tenant. Consider PostgreSQL RLS in an ADR before relying on it; application isolation remains mandatory.

## MVP scope
Invitation-based onboarding; owner/manager/employee roles; authentication and password recovery; multimodal report submission without a task; processing status and retry; original transcript and English translation; structured report; manager filters, evidence, edits and approval; CSV export; simple optional projects/tasks; installable mobile PWA with microphone permission handling and file-upload fallback.

Initial submission requires connectivity. Do not cache employee responses/media in a service worker. Enforce file type/size/duration limits, tenant usage limits, audit events, private storage and configurable retention/deletion. Validate media by content, use safe generated names, prevent executable uploads and validate/strip unnecessary metadata. Provider data handling and retention settings must be reviewed before customer onboarding.

Deferred: WhatsApp, automated billing, advanced analytics and full offline synchronization. Pilot subscriptions and quotas can be administered manually. Production provider, domain, email, storage and backup destinations are unresolved until deployment planning.
