# Current handoff

Date: 2026-11-05 (Asia/Dubai).
Branch: codex/5-employee-device-onboarding, from dev at 88fd31a.
Foundation PR #14 was authorized and squash-merged into dev; #1-#4 closed. main unchanged. No production deployment.
Issues #5/#6 track tenant isolation and employee onboarding. Inspect Git HEAD/branch PR for latest CI.

## Implemented
- Approved clarification: employees may not read/write; no employee self-registration, email or password. Manager creates named profile and supplies one-use QR/link. ADR 0004 records lifecycle, threat boundaries and device limitations.
- Tenants and unique role memberships; explicit actor/tenant access services; PostgreSQL composite tenant/membership constraints for invitations/devices. Roles belong to memberships, not a global user role.
- Manager dashboard creates/selects workspaces, adds employee profiles, renders QR locally, copies/reissues links, revokes devices and disables employees. Manager invitation/role-grant UI and re-enabling disabled membership are not included.
- Activation requires CSRF POST after one large button. Random hashed 30-minute single-use token uses URL fragment removed on load. Manager sessions cannot be replaced. Encrypted HttpOnly SameSite device cookie expires absolutely after 90 days; each request validates membership/device before route auth. Revocation blocks live sessions. No global mutable tenant context/background jobs added.
- Employee surface has profile/workspace, large icons, optional Arabic device speech, install guidance/button and manifest starting /employee with local PNG icons. No service worker/offline cache/persistent login URL. Personal HTTP responses use no-store/no-referrer. Guests opening the app icon go to manager-assisted activation instructions, not the manager login.
- Reports/audio/images/AI remain T07+. Profile uses a generic icon; recognizable photos, multilingual guidance and literacy/accessibility testing require later work before pilot use.

## Verified
- Full composer test passed: Pint 67 PHP files, PHPStan level 7, 55 tests / 248 assertions. Frontend build, format/lint (73 formatted files / 65 linted files) and TypeScript passed. Employee tests passed: 12 / 111 assertions, followed by a separate real-CSRF rejection test (1 / 3 assertions). CI reruns all 56 tests on the final branch.
- Tests cover two-tenant denial for read/mutations, roles differing across memberships, PostgreSQL association/uniqueness constraints, token hashing/expiry/replay/reissue, manager-session protection, restoration, live revocation, disabled membership, missing cookie and employee disconnect.
- Initial test/build overlap caused missing new Vite manifest entries, resolved by completed build. Initial restore tests caught auth middleware running first: explicit priority after StartSession and before Authenticate fixed this. Never weaken the isolated workforce_testing guard.
- Additive local migration applied; no reset of application data. Browser verified actual team dashboard and synthetic workspace creation. User is actively testing in the same tab; avoid replacing their forms/session or committing local data. Physical-device/PWA installation is not tested.
- qrcode.react installed locally; npm install audit reported zero vulnerabilities. Composer audit and npm production audit passed with zero advisories; Compose configuration passed. Secret scan and branch CI are recorded by PR; never assume old CI covers new HEAD.

## Runtime / release limits
Local app: http://localhost:18000/dashboard; mail: http://localhost:18025. Docker uses desktop-linux. Do not touch unrelated sortlot containers. Local .env/keys/data/builds/dependencies ignored. Source is public; synthetic fixtures only.

Computer localhost is unreachable from a phone. Do not expose dev ports or deploy production without authorization. Physical Android/iPhone install, browser/PWA cookie sharing and Arabic speech require a reachable approved HTTPS staging URL and actual devices. Separate cookie stores may need fresh activation. Dedicated phones assumed; shared-phone identity switching deferred. See docs/runbooks/employee-onboarding.md.

## Next
Finish current branch PR to dev; no merge authorization for this PR. Then T07 private multimodal intake with optional task/project, fake pipeline, actual AI fidelity and manager review. Full T12 and pilot operations remain. No WhatsApp or real employee data until pilot gates pass.
