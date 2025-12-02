# Quick API Client

[![License](https://img.shields.io/badge/License-CC%20BY--ND%204.0-lightgrey.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/release/jomardyan/Quick-API-Client)](https://github.com/jomardyan/Quick-API-Client/releases)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://github.com/jomardyan/Quick-API-Client)

A lightweight Chrome extension for testing REST APIs directly from your browser. Configure HTTP methods, URLs, headers, query parameters, and request bodies with instant response previews and cURL export functionality.

## Why Quick API Client

Quick API Client provides developers with a streamlined API testing tool that lives in the browser toolbar. Test endpoints without leaving your development environment, view formatted JSON responses with syntax highlighting, and generate cURL commands for documentation or sharing with your team.

## Key Features

- **Multiple HTTP methods** — Supports GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS
- **Query parameter builder** — Add key-value pairs that automatically encode into URLs
- **Custom headers** — Configure Content-Type, Authorization, and any custom headers
- **Request body editor** — Raw text input with automatic JSON formatting and validation
- **Response viewer** — Syntax-highlighted JSON and plain text with status codes and timing metrics
- **cURL export** — One-click copy of formatted cURL commands for CLI or documentation
- **Request history** — Automatically saves recent requests with timestamps for quick access
- **Built-in presets** — Quick-start templates for JSONPlaceholder, GitHub API, and HTTPBin
- **Light/Dark themes** — Manual theme selection or automatic system preference detection

## Installation

### From Source

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Pin the extension icon to your toolbar for quick access

## Quick Start

Open the extension popup and test an API in three steps:

```
1. Select HTTP method (GET, POST, etc.)
2. Enter the API URL
3. Click "Send Request"
```

### Basic GET Request

```
Method: GET
URL: https://jsonplaceholder.typicode.com/posts/1
Headers: Accept: application/json

Response: 200 OK with JSON data
```

### POST Request with JSON Body

```
Method: POST
URL: https://httpbin.org/post
Headers: 
  Content-Type: application/json
  Accept: application/json
Body:
{
  "name": "Quick API Client",
  "version": "1.0.0"
}
```

## Usage

### Adding Query Parameters

Click "Add Query Param" to create key-value pairs. Parameters are automatically URL-encoded and appended to the request URL.

### Configuring Headers

Click "Add Header" to define custom headers. Common examples:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `Accept: application/json`
- `User-Agent: Quick-API-Client`

### Request Body

Enter raw text or JSON in the body field. For JSON requests, the extension automatically formats and validates syntax. Body is ignored for GET and HEAD methods.

### Using Presets

Select a preset from the dropdown menu and click "Apply Preset" to load pre-configured requests for popular APIs:
- **JSONPlaceholder** — Free fake REST API for testing
- **GitHub API** — Public repository information
- **HTTPBin GET** — Echo service with query parameters
- **HTTPBin POST** — JSON echo service

### History

Recent requests are automatically saved with timestamps. Click any history item to restore the complete request configuration. Clear history using the "Clear History" button in the History tab.

### Copying Results

- **Copy Headers** — Copy response headers to clipboard
- **Copy Body** — Copy response body as plain text
- **Save Body** — Download response body as a text file
- **Copy cURL** — Export the request as a formatted cURL command

### Theme Selection

Click the theme button to cycle between:
- **System** — Follows OS dark/light mode preference
- **Dark** — Dark theme
- **Light** — Light theme

## Configuration

Access the Options page by right-clicking the extension icon and selecting "Options".

### Available Settings

- **Theme** — Default theme preference (system, light, dark)
- **Default URL** — Pre-filled URL when opening the extension
- **Default headers** — Headers automatically added to new requests
- **Restore last request** — Resume previous request on extension open
- **Request timeout** — Maximum wait time in milliseconds (default: 15000)
- **History size** — Number of requests to save (0-50, default: 8)
- **Enable history** — Toggle history tracking on/off

## Development

### Project Structure

```
Quick-API-Client/
├── manifest.json       # Extension configuration
├── popup.html          # Main UI
├── popup.js            # Request logic and UI handlers
├── popup.css           # Styling with theme support
├── background.js       # Service worker for API requests
├── options.html        # Settings page UI
├── options.js          # Settings logic
├── options.css         # Settings styling
├── icons/              # Extension icons (16, 48, 128px)
└── PRIVACY.md          # Privacy policy
```

### Running Tests Locally

1. Make changes to source files
2. Navigate to `chrome://extensions/`
3. Click the reload icon on the Quick API Client card
4. Open the extension popup to test changes

### Building for Distribution

Create a ZIP file with all source files except `.git` directory:

```bash
zip -r quick-api-client.zip . -x "*.git*" -x "*.DS_Store"
```

## Permissions

- **storage** — Save settings, request history, and last request state
- **clipboardWrite** — Copy cURL commands and response data
- **optional_host_permissions** (`<all_urls>`) — Send requests to any API endpoint (requested per-origin when needed)

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear messages
4. Push to your fork and submit a pull request
5. Ensure code follows existing style conventions

For bug reports and feature requests, open an issue with detailed information and reproduction steps.

## License

This project is licensed under the **Creative Commons Attribution-NoDerivatives 4.0 International License (CC BY-ND 4.0)**.

You are free to:
- Use this extension for personal or commercial purposes
- Share and redistribute the extension in its original form

You are NOT permitted to:
- Modify, adapt, or create derivative works
- Distribute modified versions

See the [LICENSE](LICENSE) file for full legal details.

## Author

**Hayk Jomardyan**

- GitHub: [@jomardyan](https://github.com/jomardyan)
- Repository: [Quick-API-Client](https://github.com/jomardyan/Quick-API-Client)

## Privacy

Quick API Client does not collect, transmit, or store any personal data externally. All requests, history, and settings are stored locally in your browser. See [PRIVACY.md](PRIVACY.md) for complete privacy policy.
