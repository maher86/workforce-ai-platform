# Platform administration

Company customers have one company per account. A company owner is not a platform administrator. Ordinary signup never grants platform access.

## Bootstrap a separate operator account

From a trusted terminal on the local development computer:

```powershell
docker --context desktop-linux compose exec app php artisan platform:create-admin platform-admin@example.com
```

Replace the example email with a private address controlled by the platform owner. Enter the password privately in the terminal and confirm it. It needs at least twelve characters with upper/lowercase, a number and symbol. The command never displays it and refuses any email already used by a customer account. Never paste credentials into a chat, issue, command argument, public configuration or Git. No real operator account was created as part of automated feature tests.

Sign in through /login. Verify email with the normal resend action (Mailpit locally; configured SMTP when deployed). Enable and confirm two-factor authentication in /settings/security. Keep recovery codes privately. Open /platform and confirm the password when requested; the platform console requires confirmation within ten minutes. Dashboard automatically routes this distinct account to the platform console. Customer company roles are not granted.

Choose a company, provide a technical ticket reference/reason without employee data, and start diagnostics. The view expires after fifteen minutes and may require another password confirmation after ten minutes. The operator remains signed in as themselves. The console shows aggregate counters and failure IDs/codes only; it cannot read recordings/transcripts/photos or edit customer records. No master password or implicit impersonation exists. Review the company's audit entries for platform.diagnostics_started and platform.diagnostics_viewed. Diagnostic reasons are encrypted in the private database; apply a production support-log retention policy before customer rollout.

## Resolve an old multi-company management account

First inspect authorized memberships privately and obtain the account owner's selected company. Do not identify the company from a display name alone. The CLI uses numeric IDs and a comparison against the expected prior binding:

```powershell
docker --context desktop-linux compose exec -T app php artisan company:bind-account USER_ID COMPANY_ID --expected-company=none
docker --context desktop-linux compose exec -T app php artisan company:bind-account USER_ID COMPANY_ID --expected-company=none --apply
```

Use the current numeric company ID instead of none when already bound. The first command is a dry run. An absent/inactive authorized membership, employee/platform identity or changed previous binding is rejected. This narrows management access without deleting the other company, historical membership or employee data. It is not a way to grant access to an unrelated company. Record approval and operator execution privately; do not commit real IDs or customer details.

The migration automatically anchors only users with one unambiguous active management company. Ambiguous users fail closed until resolved. Rollback removes the new columns and diagnostic grants, so it restores the older authorization model; do not roll back in production without evaluating that security effect and preserving support audit records.
