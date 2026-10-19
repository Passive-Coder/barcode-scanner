# Linework barcode scanner

A browser based barcode scanner built with the supplied Dynamsoft Barcode Reader JS 11.6.3200 package. Scan with a camera or select an image. The app shows the decoded value, barcode format, byte size, capture source and time, plus basic interpretation of URLs, email addresses, phone numbers, Wi-Fi codes, contacts, and retail identifiers. Scan history remains in memory for the current page session.

## Run locally

Serve the repository root over HTTP and open the printed URL:

```sh
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). Camera access requires localhost or HTTPS. Image scanning works without a camera. The scanner SDK's runtime assets are included under `vendor/dynamsoft` and must be served along with the app.

## Deploy to Cloudflare Workers

Prepare a clean static output directory and deploy it as a Cloudflare Worker with static assets:

```sh
node scripts/build.mjs
npx wrangler deploy
```

The build copies only the app shell, source, and required Dynamsoft distribution files. `dist/` is generated and ignored by Git. The deployment settings are in `wrangler.toml`.

## License

Dynamsoft requires a valid license to decode barcodes. The sample key in the supplied package was rejected by Dynamsoft's license server. The app instead starts with [Dynamsoft's documented public test key](https://www.dynamsoft.com/barcode-reader/docs/web/programming/javascript/user-guide/), which is valid for 24 hours in a newly authorized browser. For continued use, open the gear icon in the app and enter your own key. The key is stored in this browser's local storage. License verification needs network access to Dynamsoft. A 30-day trial key can be requested from [Dynamsoft](https://www.dynamsoft.com/customer/license/trialLicense?product=dbr&package=js).

If Dynamsoft authorization fails, the app uses the browser's built-in `BarcodeDetector` when available. This fallback supports the formats provided by that browser; it is unavailable in some browsers.

## Structure

- `index.html`: semantic app shell
- `src/app.js`: interface and session state
- `src/scanner.js`: Dynamsoft camera and image capture
- `src/native-scanner.js`: browser scanner fallback
- `src/interpret.js`: safe, local interpretation of common payloads
- `src/styles.css`: responsive interface
- `vendor/dynamsoft`: supplied SDK runtime and legal notices

Barcode values alone do not contain product names or prices; retail codes are shown as identifiers. No image or decoded result is sent to an application server.
