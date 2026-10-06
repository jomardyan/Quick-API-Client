# Quick API Client — store artwork

Artwork for extension version **1.2.1**, generated from editable vector artwork and the current extension UI. Requirements checked against the official store documentation on **2026-10-06**.

Open `preview.html` for the complete artwork gallery, or `contact-sheet.png` for a single review image. The preview and contact sheet are review artifacts, not store uploads.

## Upload mapping

| Store field | File | Dimensions | Format |
| --- | --- | --- | --- |
| Chrome extension / listing icon | `chrome/store-icon-128.png` and packaged `icons/icon128.png` | 128 × 128 | RGBA PNG; 96 × 96 artwork with 16px transparent padding |
| Chrome required small promotional image | `chrome/promo-small.png` | 440 × 280 | 24-bit RGB PNG, no alpha |
| Chrome optional marquee image | `chrome/promo-marquee.png` | 1400 × 560 | 24-bit RGB PNG, no alpha |
| Chrome screenshots, in filename order | `chrome/screenshots/01-*.png` through `05-*.png` | 1280 × 800 | 24-bit RGB PNG, no alpha; five screenshots |
| Edge extension logo | `edge/store-logo-300.png` | 300 × 300 | RGBA PNG; recommended logo dimensions |
| Edge optional small promotional tile | `edge/promo-small.png` | 440 × 280 | 24-bit RGB PNG, no alpha |
| Edge optional large promotional tile | `edge/promo-marquee.png` | 1400 × 560 | 24-bit RGB PNG, no alpha |
| Edge screenshots, in filename order | `edge/screenshots/01-*.png` through `06-*.png` | 1280 × 800 | 24-bit RGB PNG, no alpha; six screenshots |

Chrome requires an icon, a small promotional image, and at least one screenshot; it accepts up to five screenshots. Edge requires a logo for each listing language; its promotional tiles and screenshots are optional, with up to six screenshots. Shared screenshots use 1280 × 800, accepted by both stores. The promotional tiles intentionally have no text or browser logos, following Chrome's visual-brand guidance. All files are under 5 MiB; the generator checks this conservative file-size limit.

## What the screenshots show

1. REST GET request with JSON response, headers, status, and timing in the dark theme.
2. POST request with JSON body and a 201 response in the light theme.
3. GraphQL query and variables with a JSON response.
4. The actual JavaScript Fetch code-generation dialog.
5. Settings for Production and Staging environments with reusable variables.
6. The actual response-validation dialog (Edge only).

Screenshots capture the extension's own HTML/CSS/JavaScript, in its supported full-tab view or options page. The captured UI is not reconstructed or redesigned. Listing headlines and backgrounds surround the captures. Sample requests, response bodies, timing, favorites, and environments come from `scripts/store-fixtures.js`; they are illustrative fixtures, not live API results or performance claims. HTTP/HTTPS traffic is blocked while capturing. Fixtures never run inside the distributed extension.

The original captures are in `source/screenshots/` at 1280 × 720. `source/icon.svg` is the editable brand master, and `source/logo-1024.png` is a transparent high-resolution export. The repository's `icons/` folder contains PNG icons at 16, 20, 24, 32, 48, 64, 96, 128, 256, and 512 pixels. Sizes up to 32px use slightly less padding for toolbar legibility. `manifest.json` references the 16, 32, 48, and 128px images for both extension and action icons.

## Regenerate and verify

From the repository root:

```sh
npm ci
npx playwright install chromium
npm run assets:generate
npm run assets:check
```

The compatibility entry point `node generate-screenshots.js` performs the same generation. Generation uses Playwright and Sharp locally; it needs no account, secret, or image-generation API. The inventory in `asset-manifest.json` records dimensions, channels, transparency, file sizes, and upload purposes. Verification checks every PNG, icon padding, screenshot counts, and icon references in the extension manifest.

Artwork is editable SVG and browser-rendered UI, rather than an AI-generated raster: no image-generation prompt was used. The design brief is a blue rounded-square mark with mint outbound and amber inbound arrows, a central white connection point, dark blue promotional fields, and matching mint/amber routing lines.

Generation replaces known asset filenames. It does not publish a listing, change the extension version, or rebuild existing extension archives under `dist/`. Build a new extension package from the updated source before submitting updated packaged icons. Upload the listing artwork separately from the extension package. `quick-api-client-store-assets.zip` is an artwork delivery bundle, not an installable extension package; re-create it after regenerating images if using the ZIP for delivery.

## Official requirements

- [Chrome Web Store — Supplying Images](https://developer.chrome.com/docs/webstore/images)
- [Microsoft Edge Add-ons — Store listing details](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-7-enter-store-listing-details-for-each-language)
