# Quick API Client

A Chrome and Edge extension for testing REST and GraphQL APIs.

## Features

- HTTP methods, headers, repeated query parameters and raw request bodies
- GraphQL query and variables editor
- Named environments, favorites and local request history
- Cancellation, configurable timeouts and response timing
- Request sharing and code generation for eight targets
- JSON, XML, HTML and CSS parsing checks

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

The release script validates source before bumping versions. It updates the manifest, package and lockfile together and includes all runtime modules. GitHub Actions runs lint, regression tests, packaging and the Chromium smoke test, then provides the current ZIP as an artifact.

## Operating limits

Request and decoded response bodies are limited to 5 MiB. Larger responses fail explicitly. JSON responses above 200,000 characters display as plain text to keep the interface responsive. Copy and download retain the raw response text. Responses are text-oriented and do not provide lossless binary downloads.

Timeouts range from 1 to 60 seconds. Chrome can terminate an extension service worker if response headers take over 30 seconds to arrive. The UI reports a disconnected background or recovers after the configured timeout plus five seconds. Failed or interrupted requests are never automatically retried because the server may already have processed them. See the [Chrome service worker lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Browser networking still controls restricted request headers, redirects and TLS validation. Cookies are omitted and the HTTP cache is bypassed. Closing the request page attempts to cancel its active request. Cancellation cannot reverse an action already performed by an API.

Favorites, settings and environments use browser sync storage and remain subject to its quota. History and the last request use local extension storage. Request exports contain the entered headers and body. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Author and license

Hayk Jomardyan - [GitHub](https://github.com/jomardyan)

The repository contains the Creative Commons Attribution-NoDerivatives 4.0 International license. See [LICENSE](LICENSE).
