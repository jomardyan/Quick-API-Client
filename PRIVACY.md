# Privacy Policy for Quick API Client

**Last Updated:** December 2, 2025

## Overview

Quick API Client is a Chrome extension that provides a convenient popup interface for testing REST APIs. This privacy policy explains how the extension handles your data.

## Data Collection and Storage

### Local Storage Only
Quick API Client stores all data **locally on your device** using Chrome's storage API. No data is transmitted to the extension developer or any third parties.

### Types of Data Stored Locally
- **API Request Configurations:** URLs, HTTP methods, headers, query parameters, and request bodies you configure
- **Request History:** Previously sent API requests (if implemented)
- **User Preferences:** Your saved settings and interface preferences

## API Requests

### User-Initiated Requests
When you send an API request using Quick API Client:
- The request is sent **directly from your browser** to the API endpoint you specify
- The extension acts as a client tool only
- No data passes through developer-controlled servers
- The extension developer has no access to your API requests or responses

### Your Responsibility
You are responsible for:
- The API endpoints you connect to
- The data you send in requests
- Any authentication credentials or API keys you use
- Ensuring compliance with the terms of service of APIs you test

## Permissions Explained

### Required Permissions
- **storage:** Required to save your API configurations, preferences, and request history locally
- **clipboardWrite:** Required to copy cURL commands and API responses to your clipboard

### Optional Permissions
- **optional_host_permissions (<all_urls>):** Only granted when you explicitly allow the extension to make requests to specific domains. This is required to send API requests to the endpoints you specify.

## Data Usage

All data processed by Quick API Client:
- Remains on your local device or is sent directly to APIs you choose
- Is never transmitted to the extension developer
- Is never shared with third parties
- Is never used for analytics, tracking, or advertising
- Is never collected, stored, or monitored by the developer

## Data Security

Your data is protected by:
- Chrome's built-in storage encryption for locally saved data
- Direct browser-to-API communication (no intermediary servers)
- No developer access to your data

### Security Best Practices
We recommend:
- Never storing sensitive credentials in the extension
- Using environment variables or secure credential management for API keys
- Testing only with non-production data when possible
- Being cautious with API endpoints and authentication tokens

## Data Deletion

You can delete all extension data at any time by:
1. Clearing saved configurations through the extension's options page
2. Removing the extension from Chrome (automatically deletes all local data)
3. Clearing the extension's storage through Chrome settings

## Third-Party Services

Quick API Client does **not** use:
- Analytics services
- Tracking tools
- External servers or APIs (except those you explicitly choose to test)
- Any third-party data collection services

## Clipboard Access

The extension can write to your clipboard to:
- Copy cURL commands for sharing or documentation
- Copy API responses for further processing

The extension **cannot read** your clipboard and does not access clipboard data for any other purpose.

## Network Requests

All network requests made by Quick API Client are:
- Explicitly initiated by you
- Sent directly to the API endpoints you specify
- Not monitored, logged, or accessible to the extension developer

## Children's Privacy

This extension does not knowingly collect any information from users. It is designed as a developer tool and is safe for users of all ages.

## Updates to This Policy

Any changes to this privacy policy will be reflected in this document with an updated "Last Updated" date.

## Contact

For questions or concerns about this privacy policy, please:
- Open an issue on [GitHub](https://github.com/jomardyan/Quick-API-Client/issues)
- Contact the developer through the GitHub repository

## Your Rights

You have complete control over your data:
- **Access:** All data is stored locally and accessible through the extension interface
- **Deletion:** Remove the extension or clear storage to delete all associated data
- **Portability:** Export your saved configurations through the extension (if implemented)

## Transparency

Quick API Client is open source. You can:
- Review the complete source code on [GitHub](https://github.com/jomardyan/Quick-API-Client)
- Verify that no data is transmitted to external servers
- Audit all functionality and permissions usage

## Compliance

This extension operates in compliance with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles
- No personal data is collected, so most data protection regulations do not apply
