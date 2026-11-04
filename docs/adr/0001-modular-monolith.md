# ADR 0001: Modular Laravel application with Inertia

Status: accepted.

Use one Laravel deployment with React/TypeScript through Inertia. This reduces authentication, API and deployment coordination for the first channel. Keep application actions independent of transports so a future WhatsApp adapter can reuse reporting behavior. Do not introduce microservices or a generic repository abstraction without demonstrated need. Cost: frontend delivery is coupled to Laravel; extract an API when a real channel requires it.
