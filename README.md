# Workforce AI Platform

Multi-tenant workforce reporting SaaS/PWA built with Laravel, React/TypeScript, PostgreSQL, Redis and Docker Compose. Employees submit text, audio and images without requiring a predefined task. Reporting services will support a future WhatsApp adapter.

The development MVP provides manager/employee access, private text/audio/image reports, resumable queued processing, review history, CSV export and optional projects/tasks. Employees activate by QR/link and do not register or type passwords. AI defaults to clearly labelled simulation; the OpenAI adapter requires local credentials and real evaluation. Temporary PWA/phone preview is available; production deployment and remaining physical-device/provider checks have separate acceptance gates.

- [Architecture and MVP](docs/architecture/overview.md)
- [Delivery backlog](docs/backlog.md)
- [Development setup](docs/runbooks/development.md)
- [Try employee QR activation](docs/runbooks/employee-onboarding.md)
- [Temporary phone HTTPS preview](docs/runbooks/phone-preview.md)
- [Product requirement coverage (Arabic)](docs/product/mvp-coverage.ar.md)
- [Reporting and pilot operations](docs/runbooks/reporting.md)
- [Current employee workflow and test steps (Arabic)](docs/product/employee-workflow.ar.md)
- [Delivery and security](docs/runbooks/delivery.md)
- [Current handoff](docs/handoffs/current.md)

This repository is public. Never commit secrets, employee/customer data or production configuration. Use synthetic test fixtures only.
