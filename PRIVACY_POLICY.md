# Privacy Policy for Quick API Client

Effective date 2026-09-11

Quick API Client is provided by Hayk Jomardyan. This policy describes the extension's implemented data handling.

## API requests

When you send a request, the extension transmits its URL, query parameters, headers and body directly to the selected API server. That server receives the connection's IP address and any credentials or personal information you include. Redirects follow browser networking rules. The extension omits browser cookies from its fetch requests.

The extension does not send request data to a developer-operated relay, analytics service or advertising service. It does not monitor general browsing activity.

## Browser storage

The extension saves the most recent request and enabled request history in local extension storage. These records may include URLs, headers, credentials and bodies entered by the user.

Settings, favorites and environment variables use browser sync storage. The browser provider may synchronize these records through the signed-in browser account, according to its settings and policies. The extension does not encrypt these values itself. The developer does not retrieve them.

Response bodies are displayed in the request page. They are not added to saved history. You can copy or download a response explicitly.

## Sharing

Request exports include the request URL, headers, query parameters, body and GraphQL settings. Base64 encoding is not encryption. Copying an export to the clipboard and sharing it can disclose credentials or other information contained in that request.

## Permissions and controls

The extension uses the storage permission and asks for optional access to API hosts. It does not require access to browsing history or all open tabs.

You can disable or clear request history, edit or delete favorites and environments, revoke host access in the browser, or uninstall the extension. Disabling history prevents new history entries but does not remove the separate last-request draft. Resetting preferences preserves favorites. Browser synchronization and API-server retention are controlled by their respective providers.

## Policy updates and contact

This file is updated when implemented data handling changes. For questions, contact Hayk Jomardyan through the [project repository](https://github.com/jomardyan/Quick-API-Client).
