# Android pilot

This is an owner-requested debug sideload pilot; release tasks are disabled. It reuses the current HTTPS Laravel employee app. See ADR0011 for security, cookies and limitations.

## Build

Use Node22+, JDK21 and Android SDK36. This computer currently has Docker Node22 but no host Java/SDK; GitHub's Android pilot workflow provides the first compilation. `WORKFORCE_ANDROID_ORIGIN` must contain exactly one HTTPS origin (no path, token, query, userinfo or custom port).

From apps/android: `npm ci`, set that environment variable, `npm test`, `npm run sync`, then from android run `./gradlew testDebugUnitTest lintDebug assembleDebug` (Windows: gradlew.bat). APK: android/app/build/outputs/apk/debug/app-debug.apk. Generated assets/config, local.properties, node_modules, keys and APKs are ignored. Never copy employee media or .env into this project. Laravel/OpenAI stay on the server.

The GitHub workflow uses repository variable WORKFORCE_ANDROID_PILOT_ORIGIN for its debug endpoint, falling back to https://workforce.invalid for safe compile-only builds. Artifacts expire after3 days. A real endpoint is public configuration, never an activation credential; no API keys are needed in Android CI. Native tests/lint/build run separately from the single PostgreSQL test runner. Download the workforce-android-debug artifact only after that exact commit passes. Verify its SHA256.

## First employee test

1. Install the debug APK on an Android7+ physical phone and open Workforce.
2. Manager issues a fresh one-use QR for the employee, using the same configured HTTPS server.
3. In the APP tap the QR icon, allow camera if requested and scan. Confirm activation with the existing large arrow. Chrome activation does not activate this app.
4. Tap microphone; allow Android microphone on first request. Record a synthetic short sample, tap Stop. Audio must attach immediately without another recorder or Use recording screen. Listen, optionally add a synthetic image, then Send.
5. Remain home: transfer/processing circle, check only on actual ready or X plus diagnostic. Check original and English in manager view. Real ASR is an explicit owner test using the locally configured key.
6. Close/reopen app: employee profile should restore without QR until device expiry/revocation. Manager revocation must block further report/file access. Test a foreign-origin/wrong/expired QR, denial, repeat Stop, interruption/background/180-second limit, deletion before Send and application kill. Kill may lose unsent media; never claim closed-app transfer.

The initial build's signing key is disposable debug signing. A subsequent build may require uninstall/new QR; do not silently clear an employee's app data. Set up a privately stored stable signing key before pilot upgrades. Never share production signing credentials in chat/repository.

Temporary Cloudflare hostname expiry breaks connectivity in both PWA and APK. Keep the development server/tunnel running; changing its origin requires another pilot build/new activation. Stable HTTPS deployment is the next prerequisite for durable use. Offline error screen has a single retry icon and manager diagnostic; it cannot repair an expired server.
