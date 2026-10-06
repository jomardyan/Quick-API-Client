# Quick API Client

A Chrome and Edge extension for testing REST and GraphQL APIs.

## Features

- HTTP methods, headers, repeated query parameters and raw request bodies
- GraphQL query and variables editor
- Named environments, favorites and local request history
- Cancellation, configurable timeouts and response timing
- Request sharing and code generation for eight targets
- JSON, XML, HTML and CSS parsing checks
- Responsive popup and full-tab workspace with side-by-side request and response panels
- Keyboard-accessible dialogs, visible validation feedback and direct access to settings
- Light theme by default with a two-way light/dark toggle

## Install

Download the latest versioned ZIP from `dist`, extract it, and use Load unpacked in your browser's extension management page with developer mode enabled. Grant access to the API host when sending a request. Use the open-in-tab control for requests that should remain visible while switching browser tabs.

## Development and verification

Requires Node.js 22, npm, Bash, jq, zip and unzip.

```sh
npm ci
npm run lint
npm test -- --runInBand
./release.sh --no-bump
npx playwright install chromium
npm run test:browser
```

The browser smoke test extracts the release ZIP and starts a local fixture server. Its temporary manifest pregrants only that fixture host. The distributed manifest continues to request optional permissions. The test exercises real extension messaging and HTTP requests. It requires an environment that permits Chromium processes and local sockets.

On Windows, `npm test` and both browser checks work directly from PowerShell. To check source changes before packaging, run `npm run test:browser:source`. Browser checks open the actual toolbar popup with Chrome's automatic sizing and cover tab widths from 320 to 1560 pixels, short dialogs, favorites, settings validation and request handling. Review screenshots in `test-results/`.

The release script validates source before bumping versions. It updates the manifest, package and lockfile together and includes all runtime modules. GitHub Actions runs lint, regression tests, packaging and the Chromium smoke test, then provides the current ZIP as an artifact.

## Build a Chrome / Edge store ZIP with GitHub Actions

Open **Actions → Build store release → Run workflow** and select the branch or tag to package. After it succeeds, download the **quick-api-client-v<version>.zip** artifact and upload that ZIP directly to the Chrome Web Store or Microsoft Edge Add-ons dashboard. No extraction or repackaging is needed. It contains the manifest at the ZIP root and the same runtime files as `make pack`. The workflow uses GitHub's direct-file artifact upload with `archive: false` to avoid nesting the extension ZIP inside another ZIP.

Every push to **main** automatically builds the ZIP and attaches it to a GitHub prerelease named `v<manifest version>-build.<run number>`. Build numbers let successive pushes use the same manifest version, and rerunning a build refreshes its ZIP. Manual runs also offer **Also publish the ZIP as a GitHub release**. The workflow reuses validation and `release.sh --no-bump`, so it packages the committed version after lint, tests and the packaged Chromium checks pass.

No additional secrets or manually pushed tags are needed. Increase and commit the extension version before submitting an update to the stores; build numbers identify GitHub releases and do not change the manifest version. Update `manifest.json`, `package.json` and both root version fields in `package-lock.json` together, or use `./release.sh patch`. The package version must be greater than the version already published in the store: this release uses **1.2.1** to update the published **1.2.0**.

## Operating limits

Request and decoded response bodies are limited to 5 MiB. Larger responses fail explicitly. JSON responses above 200,000 characters display as plain text to keep the interface responsive. Copy and download retain the raw response text. Responses are text-oriented and do not provide lossless binary downloads.

Timeouts range from 1 to 60 seconds. Chrome can terminate an extension service worker if response headers take over 30 seconds to arrive. The UI reports a disconnected background or recovers after the configured timeout plus five seconds. Failed or interrupted requests are never automatically retried because the server may already have processed them. See the [Chrome service worker lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Browser networking still controls restricted request headers, redirects and TLS validation. Cookies are omitted and the HTTP cache is bypassed. Closing the request page attempts to cancel its active request. Cancellation cannot reverse an action already performed by an API.

Favorites, settings and environments use browser sync storage and remain subject to its quota. History and the last request use local extension storage. Request exports contain the entered headers and body. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

Open in tab carries the current draft into the new workspace immediately, even when restoring the last request in the popup is disabled. Compact views reveal the response after sending. Response downloads use an extension matching the content type and preserve the raw text.

## Author and license

Hayk Jomardyan - [GitHub](https://github.com/jomardyan)

The repository contains the Creative Commons Attribution-NoDerivatives 4.0 International license. See [LICENSE](LICENSE).
