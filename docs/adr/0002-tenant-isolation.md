# ADR 0002: Shared PostgreSQL with explicit tenant isolation

Status: accepted.

Use tenant_id on tenant-owned rows and membership-based policies, tenant-scoped access, private storage and database constraints. Membership and role belong to the user/tenant association, not a global user role. Jobs carry explicit tenant identity and reset context between executions. Cross-tenant negative integration tests are required. Shared infrastructure lowers pilot operating cost but makes isolation a release-blocking invariant. RLS may be added after an explicit design and worker/connection-pool tests; it is not assumed to exist.
