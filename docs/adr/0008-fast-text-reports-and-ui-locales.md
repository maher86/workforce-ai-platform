# ADR 0008: Fast text reports and independent UI languages

Status: accepted, owner clarification 2026-11-08.

New reports default to the `text` analysis mode: original-language transcription for audio, then faithful English translation. Images remain private attachments and are not sent for AI image observations or structured explanations in this mode. Text-only reports still work; new images still require audio. The original and English are the primary report view for employees and managers. Unknowns and negation must remain faithful. English content stays English even when the manager UI is Arabic; UI preferences never become speech-language hints.

Persist analysis_mode per report. The migration assigns full to historical rows, preserving their processing contract. SubmitReport alone selects the configured default for new reports; employees cannot choose it through request payloads. Replays, amendments, retries and queued jobs retain the original mode. Optional full processing and historical outputs remain available internally, with their existing provenance/validation. Do not regenerate old reports on rollout. Image-only submissions remain rejected by the shared action.

Audio with three images now needs two provider requests rather than six in text mode. Text-only needs one rather than two. This is a request-count reduction, not a fixed latency guarantee. Translation uses minimal reasoning only for compatible gpt-5-mini IDs, with the existing model, strict response schema, no tools and store=false. Other models receive no added reasoning parameter. Translation prompt version becomes workforce-v2; original transcripts, outputs and uncertainties remain separate. Persist measured per-stage milliseconds with usage metadata, never raw request content in operational logs.

Text-mode continuations use the report-text queue before default. Two queue workers bound ordinary provider concurrency; no promise about project rate limits follows from this setting. Report/source-version locks, tenant checks, retries and recovery remain mandatory. Quotas use Dubai day boundaries. Directory user/device counts use correlated tenant/membership subqueries rather than per-employee requests.

Manager UI supports ar/en with RTL/LTR, validated session and encrypted HttpOnly preference cookie. The CSRF-protected locale action stores no tenant data and changes no roles. UI dictionaries apply only to controls, labels and system messages. Names, plates, phone values, original speech and English report content are not UI translation inputs. Custom manager pages use their own simple layout; account/auth screens also use localized controls. Historical reviews and service facts remain optional collapsed content.

See the capacity runbook for the reproducible 50-employee demo queue simulation and its limits. Production hosting, stable HTTPS, provider quotas, real media concurrency and human multilingual review remain separate rollout checks.
