# ADR 0004: Manager-assisted employee device activation

Status: accepted product direction; physical-device validation pending.

Employees may be unable to read or type. They never register, supply email addresses, or create passwords. A verified manager creates a named profile inside an authorized tenant and hands the employee a one-use activation link or QR. Managers retain verified-email login, password recovery and optional two-factor controls.

## Credential lifecycle

- Activation tokens contain 64 random alphanumeric characters, expire after 30 minutes and are stored only as SHA-256 hashes. Issuing another token invalidates pending invitations for that membership. The authorized manager receives the link once through an encrypted server session and no-store response. QR rendering is local; no third-party QR service receives credentials.
- The URL fragment is removed from browser history on load and sent only in a same-origin CSRF-protected POST after the employee presses the large entry button. GET and link previews do not consume tokens. Logging/analytics must never capture tokens or request bodies. Redirect URLs never include credentials.
- Issue/accept/revoke actions lock membership first. Acceptance rechecks active employee membership and expiry inside the transaction. Composite foreign keys reject another tenant's membership.
- Acceptance creates an opaque encrypted HttpOnly SameSite=Lax device cookie and rotates the Laravel session ID. Only the device token hash is stored in the database. The device expires absolutely after 90 days; ordinary session expiry does not require another QR. HTTPS makes the cookie Secure. Credentials never appear in the manifest, installed app URL or localStorage.
- Every web request revalidates membership, device expiry and revocation. Restoration runs after session startup and before route authentication. Employee-only identities cannot enter manager routes/settings/recovery or grant themselves manager roles. Activation never replaces an existing manager session.
- A manager can revoke all employee devices or disable membership. Both invalidate pending invitations. Employee disconnect revokes the current device. Lost devices, cleared browser data and absolute expiry require a fresh manager-issued QR. No permanent public profile/login link is created.

## Usability and installation

The employee surface has no manager navigation: large icons, one entry button and optional Arabic speech through the available device speech engine. Managers assist scanning and installation. Translated/recorded guidance and recognizable profile photos should be evaluated with target users before pilot use; text fallbacks do not establish accessibility.

The manifest launches `/employee` in standalone mode with local icons. No service worker or offline cache is introduced. Personal HTTP responses use no-store. Installation support and cookie sharing between browser/installed iOS apps vary: validate Android and iPhone on reachable HTTPS staging. A separate cookie store may require reactivation. The browser controls installation prompts; the app cannot silently install itself.

Compose remains loopback-only. Computer localhost cannot be opened from another phone. Do not expose the development server or weaken network isolation for the demo. Physical-phone checks need a separate approved HTTPS staging deployment. Dedicated employee phones are the initial model; shared phones require a separate identity-switching design.

## Boundaries and release gates

Identity actions under `app/Modules/Identity` accept an explicit actor/tenant independent of HTTP/Inertia. Reporting/media actions must independently authorize membership, including jobs. There is no global mutable tenant context.

This delivers employee onboarding and initial install metadata, not report capture or full T12. Real employee data/production use remain gated on media isolation, audit/retention, quotas and pilot operations. Manager role grants/invites are not exposed here; they must retain stronger authentication and cannot reuse employee activation.

References: [Laravel authentication](https://laravel.com/framework/docs/13.x/authentication), [MDN PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
