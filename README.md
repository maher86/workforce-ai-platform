# Workforce AI Platform

Multi-tenant workforce reporting SaaS/PWA built with Laravel, React/TypeScript, PostgreSQL, Redis and Docker Compose. Employees submit text, audio and images without requiring a predefined task. Reporting services will support a future WhatsApp adapter.

The development app provides manager authentication, tenant memberships, manager-assisted employee QR/link activation, revocable device access and initial PWA install metadata. Employees do not register or type passwords. Reporting and AI processing are not implemented yet; physical Android/iPhone installation remains unverified. See the runbooks and handoff for actual checks and release limits.

- [Architecture and MVP](docs/architecture/overview.md)
- [Delivery backlog](docs/backlog.md)
- [Development setup](docs/runbooks/development.md)
- [Try employee QR activation](docs/runbooks/employee-onboarding.md)
- [Temporary phone HTTPS preview](docs/runbooks/phone-preview.md)
- [Delivery and security](docs/runbooks/delivery.md)
- [Current handoff](docs/handoffs/current.md)

This repository is public. Never commit secrets, employee/customer data or production configuration. Use synthetic test fixtures only.
