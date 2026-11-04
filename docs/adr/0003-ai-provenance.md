# ADR 0003: Asynchronous AI with evidence and versioned output

Status: accepted.

Process media in Laravel jobs through provider interfaces. Keep original text/transcripts, translations, image observations and structured reports separate. Save model, schema/prompt version and usage metadata, excluding sensitive payloads from logs. Every substantive generated claim references a source or is marked uncertain. Quantity and completion claims require explicit evidence; an image alone cannot verify completion. Use synthetic fakes for automated tests and an opt-in multilingual evaluation before pilot release. Cost: additional processing stages and human review, in return for traceability and recoverability.
