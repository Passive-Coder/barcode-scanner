# Linework barcode scanner

A browser based barcode scanner using the supplied Dynamsoft Barcode Reader JS 11.6.3200 package. It decodes camera feeds and uploaded images, identifies typed values inside QR and other barcode payloads, and can record selected values to Google Sheets. The interface uses a burgundy and ivory theme inspired by the supplied apparel reference, with GSAP motion that respects reduced motion settings.

## Google Sheets workflow

1. Select **Connect Google** and grant Sheets access.
2. Paste a Google Sheets spreadsheet link, then select one of its tabs.
3. Scan a barcode to discover its fields, values, and inferred types. Supported payloads include JSON objects and arrays, URLs and query parameters, Wi-Fi codes, vCards, email and telephone links, GS1 application identifiers, and retail identifiers. Raw value, barcode format, content type, byte size, and scan time are always available.
4. Assign each sheet column a field from the latest scan. Further scans show the selected fields first and automatically write all matching values to a single new row. Fields absent from a scan leave their mapped cells blank. A scan with no matching mapped fields is not written.
5. Use the sheet workspace to add, rename, or delete tabs and columns, and add, edit, or delete rows. The app reads and displays the first 1,000 rows of the selected tab. Refresh to see changes made elsewhere.

The app accepts a Google Sheets link, not a Google Docs text document. It does not create or delete an entire spreadsheet file. Linked URLs and column mappings stay in browser local storage. Google OAuth access tokens remain in memory and are cleared on page reload; reconnect to resume writing. Scan history is kept only for the current page session. Values are sent to Google Sheets with `RAW` input mode so barcode text is not interpreted as a formula. Detected numbers and booleans retain their cell types; identifiers remain text.

## Google OAuth setup

The public OAuth Web Client ID is reused from the local Scavenger Hunt project. No client secret is included. In that Google Cloud project's OAuth client settings, add these **Authorized JavaScript origins**:

- `https://linework-barcode-scanner.passiveuser369.workers.dev`
- `http://localhost:8000` for local development

Enable the **Google Sheets API** in the same Cloud project. If the OAuth consent screen is in testing mode, add the intended Google accounts as test users. The sign-in flow requests `spreadsheets` and `userinfo.email` scopes. You can use a different OAuth Web Client ID through the app's Settings.

## Run locally

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Camera access requires localhost or HTTPS.

## Deploy to Cloudflare Workers

```sh
node scripts/build.mjs
npx wrangler deploy
```

The build copies only the app shell, source, and required vendor runtime files into the ignored `dist/` directory. The Worker name and assets configuration are in `wrangler.toml`.

## Scanner license

The sample key in the supplied Dynamsoft package was rejected by Dynamsoft's license server. The app starts with [Dynamsoft's public 24-hour test key](https://www.dynamsoft.com/barcode-reader/docs/web/programming/javascript/user-guide/). For ongoing Dynamsoft use, enter your own key in Settings; it stays in browser local storage. If Dynamsoft authorization fails, the app uses the browser's `BarcodeDetector` when available. That fallback supports only the formats provided by the browser.

## Structure

- `index.html`: semantic app shell
- `src/app.js`: camera, image, results, and session history
- `src/barcode-fields.js`: typed field extraction
- `src/sheets-workspace.js`: spreadsheet interface and field mappings
- `src/google/auth.js`: browser OAuth token handling
- `src/google/sheets.js`: Sheets REST client and spreadsheet operations
- `src/scanner.js`, `src/native-scanner.js`: Dynamsoft and browser scanner engines
- `src/interpret.js`: additional readable barcode details
- `src/styles.css`: responsive theme
- `vendor/dynamsoft`, `vendor/gsap`: required scanner and motion runtimes

Barcode values alone do not reveal product names or prices; retail codes are shown as identifiers. Barcode images and decoded results are not sent to an application server. Mapped values are sent to the chosen Google Sheet when automatic recording is on.
