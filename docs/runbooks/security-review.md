# Security and query performance review

Review date: 2026-11-22. Scope: repository, application authorization paths, local runtime configuration, locked dependencies, and team query behavior. This is a targeted engineering review, not a penetration-test certificate or production infrastructure assessment.

## Verified and corrected

- OpenAI credentials are read from server configuration by the provider adapter. The local `.env` is ignored and untracked. An exact-value comparison of the configured key against tracked files and built browser assets found no match; the key was never printed. Gitleaks 8.24.3 scanned all 53 existing Git commits with redaction and no network, with no findings. A scan cannot prove that a previously shared credential was never exposed elsewhere. Revoke any key known to have been published, including after removing a file from Git.
- The public-preview Compose service already has `APP_DEBUG=false` and secure cookies. Runtime checks confirmed those flags. Loopback development deliberately retains debug mode; do not expose that service or reuse development Compose credentials for production.
- Added framing denial, MIME sniffing protection, and a narrow CSP that blocks frames/plugins/base-URL injection on normal, redirect and exception responses. This preserves existing scripts and native recording. It is not a comprehensive script-source CSP or a substitute for output escaping.
- Team queries now return at most 24 employees per page, search name/phone in PostgreSQL, bind parameters and escape LIKE wildcards literally. The active company count is independent of the current page/search. Search/page input is bounded. Authorization is enforced before the scoped query. Removed two report-count queries unused by the Team page; report dashboard totals remain unchanged. No migration is required.
- Manager report pages already filter and paginate reports on the server. CSV export uses a cursor and neutralizes spreadsheet formulas. Private profile/report media require scoped access. The small authorized roster used for employee selection and full-cohort aggregate charts still loads company metadata; those are not unfiltered report downloads. Revisit that directory/aggregate payload when company sizes materially exceed the current 50-employee target. A contains search does not use a normal B-tree name index; add a measured PostgreSQL trigram strategy if larger real datasets justify it.
- Android PR builds previously received the stable pilot signer on same-repository PRs. They now use disposable signing only. Stable signing requires a deliberate manual build of reviewed source; see the Android runbook. Existing APKs, employees and device links are untouched. The signing workflow change takes effect in GitHub only when the reviewed workflow is published; no merge is performed here.

## Operational boundaries

OpenAI keys belong in private server environment/secret storage, never Git, React `VITE_*` variables, Android assets, QR codes or download directories. CI uses synthetic fixtures and a blank provider key. GitHub Actions Secrets are appropriate for the explicitly authorized private Android signer, subject to trusted workflow access; OpenAI processing does not require that key in CI. Restrict repository write access and review `.github/workflows` changes.

Retain HTTPS, private storage, backups, rate limits, least-privilege deployment credentials and host updates when deploying. The current temporary tunnel and development server are a demo environment, not production hosting. No production host/firewall/IAM audit or real-provider/device load test is included. No customer data is changed by this review.

Actual test and dependency-audit results are recorded in `docs/handoffs/current.md`. Database tests must use only guarded `workforce_testing`, with one runner at a time.
