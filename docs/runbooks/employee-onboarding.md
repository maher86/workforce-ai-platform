# Try employee onboarding locally

Use synthetic names only. Start with `./scripts/dev.ps1 Start` if needed.

1. Log in as a verified manager at http://localhost:18000/dashboard. Create a test workspace, then add a test employee by name. No employee email/password is requested.
2. Copy the activation link from the QR panel. Never post it in GitHub/logs/messages. It expires after 30 minutes and works once. A new QR invalidates older pending links.
3. Open a private browser window (different cookies from the manager), paste the link and press the large green entry button. GET alone does not activate the device. The employee sees their profile/workspace without the manager sidebar.
4. Reopen http://localhost:18000/employee in the same browser profile. It restores identity until absolute device expiry (90 days), revocation or browser-data deletion. Closing all private windows clears cookies; use a dedicated normal browser profile to check persistence.
5. From the manager window choose Revoke devices, then reload the employee page: access must stop immediately. Issue a new QR to restore it, or Disable access to block the employee and pending links/devices.
6. Reuse the same activation link in another private session: it must fail. Try activation while logged in as manager: it must not replace that session.

The profile explicitly says voice/image reporting is forthcoming (T07+). Synthetic demo workspace/profile data may be created locally; no real employee data.

Physical phones require a reachable, separately approved HTTPS staging URL. Computer localhost cannot work from another phone. Android installation uses the browser's Install action; iPhone uses Safari Share -> Add to Home Screen, assisted by a manager. Validate installation/cookie sharing on both devices. Never put the one-use token in the manifest start URL. If installation creates a separate cookie store, issue a fresh QR and validate activation handoff before pilot release. Persistence across private browsing, cleared data or reinstall is not guaranteed.

Automated checks: `./scripts/dev.ps1 Check`. `EmployeeOnboardingTest` covers tenant read/mutation denial, membership roles, PostgreSQL association constraints, hashes, expiry/replay/reissue, manager-session protection, device restoration, live revocation, disabled membership, missing cookies and disconnect. It does not simulate mobile OS installation or speech availability.
