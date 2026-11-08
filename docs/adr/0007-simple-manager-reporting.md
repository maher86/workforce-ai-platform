# ADR 0007: Reports appear without approval

Status: accepted, owner clarification 2026-11-08.

Employees send reports directly. Manager approval is not a submission, processing, visibility or counting gate. Do not auto-mark a report as human-approved. Preserve existing review records, source changes and service-fact provenance. Legacy review APIs remain compatible but are not exposed as a step in the reporting UI. Optional service confirmations are separate additional data, not report approval.

The manager home and report list default to today for all employees in the selected tenant, using Asia/Dubai boundaries. Show submission count, contributing employee count, employee private photo/name, submission date/time, processing status and a bounded text preview. Pending/approved/changes-requested historical review values do not filter these counts. Soft-deleted reports do not count. These are reports submitted, not independently verified tasks, operations, productivity or attendance.

Period choices: today, yesterday, seven days, thirty days, calendar month, all history, or inclusive custom dates (up to 366 days). Employee filtering keeps the selected period. Search names/phones within the authorized tenant directory; clicking a person opens their all-history report profile, with its own period controls and counts chart. All-history charts switch to monthly buckets beyond 366 days; report rows remain paginated, with date sections. Full-period counts and charts are independent of the current report page.

Manager overview and employee-profile endpoints require active owner/manager tenant membership. A foreign employee filter/profile fails, even if the actor manages another tenant. A profile path determines the selected employee; query parameters cannot substitute a coworker. Private avatar endpoints retain their authorization. Source text and AI outputs remain intact; previews truncate only the read response. No new provider calls, migrations, data rewrites or employee approval interactions are needed.

The dashboard refreshes visible pages every 30 seconds, or 10 seconds while reports process, without overlapping refreshes. It is not a real-time delivery guarantee. Existing source/English/structured processing, employee one-hour corrections and optional report photos remain unchanged.
