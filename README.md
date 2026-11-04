# Workforce AI Platform

Multi-tenant workforce reporting SaaS/PWA built with Laravel, React/TypeScript, PostgreSQL, Redis and Docker Compose. Employees submit text, audio and images without requiring a predefined task. Reporting services will support a future WhatsApp adapter.

The development foundation provides authentication and a containerized runtime. Reporting and tenant isolation are not implemented yet. See the development runbook for setup/check commands and the handoff for actual verification.

- [Architecture and MVP](docs/architecture/overview.md)
- [Delivery backlog](docs/backlog.md)
- [Development setup](docs/runbooks/development.md)
- [Delivery and security](docs/runbooks/delivery.md)
- [Current handoff](docs/handoffs/current.md)

This repository is public. Never commit secrets, employee/customer data or production configuration. Use synthetic test fixtures only.
