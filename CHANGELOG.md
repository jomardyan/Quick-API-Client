## 1.1.5 - 2026-09-11

- Prevent duplicate sends during permission prompts and ignore stale callbacks after cancellation.
- Share request preparation across sending, preview and generated code, including GraphQL and environment values.
- Preserve raw request bodies and duplicate query parameters. Validate protocols, headers and import data.
- Bound request and response bodies to 5 MiB and skip syntax highlighting above 200,000 characters.
- Report actual response bytes and preserve raw response text when copying or downloading.
- Distinguish cancellations from timeouts and clean up request controllers and streams.
- Fix generated PHP, Java and C# quoting, empty Java POST bodies, and non-JSON Fetch responses.
- Preserve GraphQL variables during restoration and prevent settings reset from deleting favorites.
- Retain active environment selection when renaming, clear it when deleting, and report failed saves correctly.
- Include all popup modules in release archives and synchronize version metadata.
- Replace copied test implementations with source-based checks and add regression and browser package tests.

# Changelog - Quick API Client

Welcome to the **Quick API Client** release log. Below is the list of changes, optimizations, and new features introduced for the Chrome Store and Edge Add-ons.

---

## [v1.1.4] - 2026-06-12

### Added
- **Material Design 3 (M3) UI Overhaul**: Implemented a comprehensive Material Design 3 color palette, typography scale, shape rounding, elevations, and states.
- **Accessibility (a11y) Upgrades**: Added full screen-reader support, implicit and explicit `<label>` element associations, `aria-label` tags for dynamic input keys/values, and ARIA attributes for modals and status messages.
- **Response Validation Tool**: Integrated an in-app validation modal enabling users to validate API responses against JSON, XML, HTML, and CSS specifications.
- **Timing Breakdown Visualizer**: Added an interactive request-response lifecycle timing panel to trace request duration details.
- **GraphQL Support**: Introduced a toggle to switch the body editor to GraphQL mode with an additional variables input box.
- **Code Snippet Generator**: Added a snippets modal supporting JavaScript (Fetch), Python (Requests), Go (net/http), PHP (cURL), and shell (cURL) conversions.
- **Environments Manager**: Added environment profiles to customize variables and use templated keys like `{{base_url}}` anywhere.
- **Import/Export (Sharing)**: Created a request-sharing module to quickly copy an encoded representation of a request and import it on any instance.

### Improved
- **Modern Theme Toggle**: Transitioned theme switching to dynamically toggle system-theme/dark/light modes seamlessly with local options storage sync.
- **Robust Memory and History**: Added history limit options, history clearing, and a checkbox to restore the last active request upon opening the popup.
- **Clean Responsive Layouts**: Built a dual-panel fluid grid that adapts smoothly to window resizing.

### Fixed
- Fixed unclosed modal focus traps and improved keyboard-accessibility shortcut handlers.
- Standardized error-handling for aborted, blocked, or failed connection requests.
