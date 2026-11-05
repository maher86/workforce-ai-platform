# Temporary phone HTTPS preview

This is a user-authorized development preview for synthetic data, not a production deployment. Cloudflare Quick Tunnels expose only the preview web service through a temporary HTTPS hostname. Do not share real employee media/data. The hostname changes when the tunnel process restarts, so PWA installation here is temporary; a stable staging/production hostname is needed for durable installed use.

## Start and stop

- Start: `./scripts/preview.ps1 Start`
- Status / last URL: `./scripts/preview.ps1 Status`
- Stop: `./scripts/preview.ps1 Stop`

Docker Desktop Linux must run. Start uses the official pinned cloudflared image, creates the tunnel, discovers its exact container IP, then starts a separate preview server without a published host port. Local app remains loopback-only. PostgreSQL, Redis and Mailpit are not forwarded. Preview debug output is disabled, its session cookie is Secure and uses a separate name from localhost. Only the tunnel's exact IP is trusted for forwarded scheme/port headers; arbitrary proxies/hosts are not trusted. No firewall/router changes or account/API tokens are required.

Complete the standard local Setup before first use. Both web servers use `artisan serve --no-reload` so Laravel preserves the Docker environment overrides; its reload mode otherwise replaces preview debug/session/public-origin settings with the local .env values. PHP source edits still load on subsequent requests. After environment changes, recreate the affected service instead of relying on .env reload. The preview is a development server and must not become a production deployment.

The current URL is stored in ignored `.preview/runtime.json`. URL/proxy settings are passed only to Docker containers, never written into committed configuration. Local manager QR generation uses the configured public origin, so it can be used from the already authenticated localhost manager window. Public preview sessions must sign in separately if a manager chooses to use that URL.

After Start, issue a **new** QR for a synthetic employee in the local manager team page. Existing localhost QRs cannot be repaired or redirected on the phone. Scan the new QR with the phone camera; it must show an HTTPS trycloudflare.com URL. Press the green entry button. Check profile loading, closing/reopening in the same browser, installation where supported and manager device revocation. A separate browser/PWA cookie store can require fresh activation; actual-device handoff remains a pilot test.

Stop ends public access and restores new local QRs to localhost. It preserves application data/volumes. Stopping Docker/computer also ends access; do not treat the temporary URL as a persistent customer link. Running the regular dev Start/Setup can recreate app settings without the public origin: run preview Start again before issuing phone QRs. If a failed Start stops the tunnel, rerun after resolving the displayed error; do not disable TLS verification or trust arbitrary proxies.

Reference: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
