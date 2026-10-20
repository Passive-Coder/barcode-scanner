# Linework barcode scanner

A browser-based barcode scanner built with **Svelte 5** and **Vite**. It decodes camera feeds and uploaded images with [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), identifies typed values inside QR and other barcode payloads, and records selected values to Google Sheets.

Wider screens show everything on one page. On phones (≤ 700 px), Google sign-in plays a short Student Council mark animation, then a home menu offers **Scan barcodes** or **Edit a spreadsheet**; both open the saved spreadsheet list, where a new sheet can be added by its link. The mark in the home header opens the account menu. The welcome screen's ribbons are drawn on a canvas and animated with GSAP.

## Getting started

Requires Node.js 20.19 or later.

```sh
npm install
cp .env.example .env   # then fill in VITE_GOOGLE_CLIENT_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The port is fixed (`DEV_PORT` in `.env`) because Google only allows sign-in from Authorized JavaScript origins. Camera access requires localhost or HTTPS.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves the production build on the same port |
| `npm run check` | Type and accessibility checks (svelte-check) |
| `npm test` | Unit tests (Vitest) |
| `npm run deploy` | Check, test, build, then `wrangler deploy` |

## Configuration

Configuration lives in `.env`, which git ignores; `.env.example` documents every variable.

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |
| `DEV_PORT` | Port for `dev` and `preview` (default 3000) |

`VITE_` values are compiled into the browser bundle, so they must be safe to publish. The client ID is: the app uses Google's browser token flow, which needs only a client ID and **never a client secret**. Do not put secrets such as a client secret, a service-account key, or a Cloudflare API token in a `VITE_` variable.

The client ID can be overridden per browser in **Settings**. An override is kept in local storage and wins over `.env`; "Use default" clears it.

## Google OAuth setup

Linework uses its own OAuth Web Client in the existing `perfect-nature-463213-t8` Google Cloud project. Allow these **Authorized JavaScript origins** for sign-in:

- `https://linework.stucovitv.in` (primary, on the owned domain)
- `http://localhost:3000` for local development (`http://localhost:8000` is also allowed)

The old `workers.dev` address redirects to the owned domain. It is not an OAuth origin, because Google requires authorised domains to be verified by the project owner.

The **Google Sheets API** is enabled in that project. The first Google sign-in requests the `spreadsheets`, `userinfo.email`, and `userinfo.profile` scopes together. The Sheets token belongs to the person signing in; no separate owner account or app-wide Sheets credential is used. Anyone whose Google account can open a linked spreadsheet can view it in Linework, and anyone with Editor access can record scans and make changes. The profile scope supplies the first name in the mobile greeting.

The shared Cloud project's OAuth audience is **External** and **In production**. Its consent app name is `stucovitv.in`, which is also shown on Linework's public homepage. Google currently marks its branding and sensitive Sheets scope as unverified. New users may see Google's unverified-app warning, and the project has a lifetime **100-user grant cap** until Google approves the scope. Broad public access requires finishing Google's branding and data-access verification for that shared project; its consent branding affects its other OAuth clients too.

Access tokens stay in memory only. When a token expires, the app keeps your place and shows a **Reconnect** banner, which signs back in to the same account. A page reload signs you out.

## Google Sheets workflow

1. Sign in with your Google account and grant Sheets access during that same sign-in.
2. Paste a Google Sheets link (or a spreadsheet ID), then choose one of its tabs.
3. Scan a barcode to discover its fields, values, and inferred types. Supported payloads include JSON objects and arrays, URLs and query parameters, Wi-Fi codes, vCards and MECARD contacts, labeled `Name: value` or `Name=value` lines, email and telephone links, GS1 application identifiers, and retail identifiers. Raw value, barcode format, content type, byte size, and scan time are always available.
4. Assign each sheet column a field from this session's scans. Further scans show the selected fields first and write all matching values to a single new row. The results panel always says whether scans are being recorded, and if not, why.
5. Use the workspace to add, rename, or delete tabs and columns, and add, edit, or delete rows. Row edits write only the cells you changed, so formulas and formatting elsewhere in the row are preserved. The app reads the first 1,000 rows of the selected tab; select **Refresh** to see changes made elsewhere.

Values are written with `RAW` input, so barcode text is never run as a formula. Numbers and `TRUE`/`FALSE` keep their cell types, and identifiers with leading zeros stay text. Linked URLs and column mappings stay in browser local storage. Scan history lasts for the current page session only.

## Barcode decoding

Barcodes are decoded by [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), a WebAssembly build of ZXing-C++, which reads QR Code, Data Matrix, Aztec, PDF417, MaxiCode, EAN/UPC, Code 128, Code 39, Code 93, Codabar, ITF, DataBar and more. No license key is needed.

Decoding runs in a Web Worker (`src/lib/scanner/zxing.worker.js`) so the camera preview stays smooth. The camera loop sends one frame at a time, scaled to at most 1280 px, so slower devices simply decode less often. Uploaded images are decoded by the browser first, so any format it can display works and EXIF rotation is respected. The WASM file is bundled with the app instead of being fetched from zxing-wasm's default CDN.

## Deploy to Cloudflare Workers

```sh
npm run deploy
```

This checks, tests, and builds, then publishes `dist/` as static assets (see `wrangler.toml`). `public/_headers` sets long-lived caching for hashed assets and basic security headers, including a camera permission policy.

## Project structure

```
src/
  main.js, App.svelte, app.css     entry point, layout switch, design tokens
  lib/
    config.js, env.d.ts            .env configuration
    storage.js, format.js          local storage and formatting helpers
    motion.js                      GSAP attachments (reduced-motion aware)
    ribbons/                       GSAP-animated canvas ribbons for the welcome screen
    feedback.js, sheet-actions.js  error toasts; dialog-driven sheet flows
    barcode/fields.js              payload parsing and typed field extraction
    sheets/values.js               spreadsheet IDs, A1 ranges, cell typing
    google/                        Google Identity Services and Sheets REST client
    scanner/                       zxing-wasm worker, camera scanner, image scanner
    stores/                        Svelte 5 rune stores: auth, workspace, session, camera,
                                   settings, dialogs, toast, layout
  components/
    ui/                            Button, Modal, dialogs, Toast, SectionHeading, SessionBanner
    brand/                         Council mark, brand mark, Google glyph, ribbon canvas
    capture/                       capture tabs, camera frame, image upload
    results/                       decoded scan, fields, details, recording status
    sheets/                        link form, picker, structure, column mapping, data table
    history/, settings/            session history; settings and account dialogs
  views/
    desktop/                       scanning studio page
    mobile/                        welcome, reveal, home, sheet chooser, workspace
```

Unit tests sit next to the modules they cover (`*.test.js`).

## Privacy

Barcode values alone do not reveal product names or prices; retail codes are shown as identifiers. Images are decoded in the browser and never uploaded. Mapped values are sent only to the Google Sheet you choose, and only while automatic recording is on.
