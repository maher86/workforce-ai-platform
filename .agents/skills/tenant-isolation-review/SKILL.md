---
name: tenant-isolation-review
description: Review tenant-owned access changes in this workforce platform, including jobs, media, exports and cache boundaries.
---

Read the affected code and `docs/adr/0002-tenant-isolation.md`. Trace how the tenant is selected from authenticated membership and how authorization survives controller, service and job boundaries. A request tenant_id or unscoped model binding is not authorization.

Inspect relational associations, list/detail/update/delete, attachment URLs, exports and cache/lock keys touched by the change. Verify worker context is cleared after success and failure. Test with two synthetic tenants and a user whose roles differ across memberships. Include forged foreign identifiers and an authorized same-tenant case.

Report concrete findings with code locations and a reproducible unauthorized behavior. Separate verified tests from assumptions. Do not claim a global scope or UUID alone provides isolation.
