# Linework barcode scanner

The Linework website: a browser-based barcode scanner built with **Svelte 5** and **Vite**. It decodes camera feeds and uploaded images with [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), identifies typed values inside QR and other barcode payloads, and records selected values to Google Sheets.

A **Cloudflare Worker** with a **D1** database adds:

- a change log of every spreadsheet change, with **Migrate changes** for changes made while Google Sheets couldn't be reached;
- **events**, each with its own roles (organizers, members, and sub-team managers), sub-teams, Google Sheets and Docs shared automatically with the right people, and alerts;
- **teams**: personal lists of names and emails, like a Google Group;
- **alerts and pages**, delivered by Web Push (and to the iOS and Android app through Expo) even when Linework is closed, with a full-screen page that stays until it's acknowledged.

Changes reach Google as soon as it responds: stored changes migrate automatically in the background, open spreadsheets and events refresh live, and Drive sharing that couldn't be done yet is retried on its own.

The same Worker serves the iOS and Android app in [`../app`](../app/README.md).

Wider screens show everything on one page. On phones (≤ 700 px), Google sign-in plays a short Student Council mark animation, then a home menu offers **Scan barcodes** or **Edit a spreadsheet**; both open the saved spreadsheet list, where a new sheet can be added by its link. The mark in the home header opens the account menu. The welcome screen's ribbons are drawn on a canvas and animated with GSAP.

## Getting started

Requires Node.js 22.13 or later (the server tests use Node's built-in SQLite). Run these in this `web/` folder:

```sh
npm install
cp .env.example .env                 # then fill in VITE_GOOGLE_CLIENT_ID
node scripts/generate-vapid-keys.mjs # Web Push keys for local alerts, written to .dev.vars
npm run db:migrate:local             # creates the local D1 database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run dev` starts Vite and the Worker (`wrangler dev` on port 8787); Vite forwards `/api` to the Worker, so the browser sees one origin. The port is fixed (`DEV_PORT` in `.env`) because Google only allows sign-in from Authorized JavaScript origins. Camera access requires localhost or HTTPS.

| Script | What it does |
| --- | --- |
| `npm run dev` | App (Vite, hot reload) and API (Worker with a local D1 database) |
| `npm run dev:web` / `npm run dev:api` | Either half on its own |
| `npm run db:migrate:local` | Applies `migrations/` to the local database |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves the production build on the same port (without the API) |
| `npm run check` | Type and accessibility checks: svelte-check for the app, `tsc` for the Worker |
| `npm test` | Unit and API tests (Vitest) |
| `npm run deploy` | Check, test, build, apply migrations to the production database, then `wrangler deploy` |

## Configuration

Configuration lives in `.env`, which git ignores; `.env.example` documents every variable.

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |
| `DEV_PORT` | Port for `dev` and `preview` (default 3000) |

`VITE_` values are compiled into the browser bundle, so they must be safe to publish. The client ID is: the app uses Google's browser token flow, which needs only a client ID and **never a client secret**. Do not put secrets such as a client secret, a service-account key, or a Cloudflare API token in a `VITE_` variable.

The Worker's settings are in `wrangler.toml`. All of them are public except the VAPID private key:

| Setting | Where | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | `[vars]` | Sign-in tokens must have been issued to this client (same as `VITE_GOOGLE_CLIENT_ID`) |
| `GOOGLE_CLIENT_IDS` | `[vars]` | The app's iOS and Android OAuth client IDs, comma-separated; their tokens are accepted too |
| `APP_ORIGINS` | `[vars]` | Browser origins allowed to make changes through the API (`localhost:8081` is the app's web build) |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | `[vars]` | Identify Linework to browser push services |
| `VAPID_PRIVATE_KEY` | secret | Signs push messages: `npx wrangler secret put VAPID_PRIVATE_KEY` in production, `.dev.vars` locally |
| `EXPO_ACCESS_TOKEN` | secret, optional | Only if Expo push security is turned on for the app's Expo project |

`.dev.vars` is git-ignored. `scripts/generate-vapid-keys.mjs` writes a new key pair there and prints the public key; if you replace the production keys, update `VAPID_PUBLIC_KEY` too, and devices must turn notifications on again.

The client ID can be overridden per browser in **Settings**. An override is kept in local storage and wins over `.env`; "Use default" clears it.

## Google OAuth setup

Linework uses its own OAuth Web Client in the existing `perfect-nature-463213-t8` Google Cloud project. Allow these **Authorized JavaScript origins** for sign-in:

- `https://linework.stucovitv.in` (primary, on the owned domain)
- `http://localhost:3000` for local development (`http://localhost:8000` is also allowed)

The old `workers.dev` address redirects to the owned domain. It is not an OAuth origin, because Google requires authorised domains to be verified by the project owner.

The **Google Sheets API** and **Google Drive API** are enabled in that project. The first Google sign-in requests the `spreadsheets`, `userinfo.email`, and `userinfo.profile` scopes together. The `drive.file` scope (non-sensitive: only files Linework creates) is requested separately, the first time an organizer creates a Sheet or Doc for an event. The Sheets token belongs to the person signing in; no separate owner account or app-wide Sheets credential is used. Anyone whose Google account can open a linked spreadsheet can view it in Linework, and anyone with Editor access can record scans and make changes. The profile scope supplies the first name in the mobile greeting.

The shared Cloud project's OAuth audience is **External** and **In production**. Its consent app name is `stucovitv.in`, which is also shown on Linework's public homepage. Google has verified its branding, while its sensitive Sheets scope still requires data-access verification. New users may see Google's unverified-app warning, and the project has a lifetime **100-user grant cap** until Google approves the scope. Broad public access requires finishing data-access verification for that shared project; the verification form still needs a demo video showing every OAuth client in the project.

Access tokens stay in memory only. When a token expires, the app keeps your place and shows a **Reconnect** banner, which signs back in to the same account. A page reload signs you out.

After Google sign-in, the browser sends its token to `POST /api/session` once. The Worker asks Google's `tokeninfo` endpoint who it belongs to and accepts it only if it was issued to Linework's own client ID for a verified email. It then opens a 12-hour session in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`__Host-` prefixed); only a SHA-256 hash of the session token is stored. Requests that change anything must also come from an allowed `Origin` with a JSON body. The Google token itself is never stored on the server.

The app signs in the same way with `tokenType: "bearer"`: its token may also come from one of `GOOGLE_CLIENT_IDS`, and instead of a cookie it gets a 30-day session token, which it keeps in the phone's secure storage (Keychain or Keystore) and sends as `Authorization: Bearer …`. Bearer requests carry no cookies, so they aren't subject to the `Origin` check; cross-origin browser requests are answered with CORS headers only for `APP_ORIGINS`, and never with credentials.

## Google Sheets workflow

1. Sign in with your Google account and grant Sheets access during that same sign-in.
2. Paste a Google Sheets link (or a spreadsheet ID), then choose one of its tabs.
3. Scan a barcode to discover its fields, values, and inferred types. Supported payloads include JSON objects and arrays, URLs and query parameters, Wi-Fi codes, vCards and MECARD contacts, labeled `Name: value` or `Name=value` lines, email and telephone links, GS1 application identifiers, and retail identifiers. Raw value, barcode format, content type, byte size, and scan time are always available.
4. Assign each sheet column a field from this session's scans. Further scans show the selected fields first and write all matching values to a single new row. The results panel always says whether scans are being recorded, and if not, why.
5. Use the workspace to add, rename, or delete tabs and columns, and add, edit, or delete rows. Row edits write only the cells you changed, so formulas and formatting elsewhere in the row are preserved. The app reads the first 5,000 rows of the selected tab. Only the rows on screen are drawn, so long sheets scroll smoothly; **Search rows** finds rows by any cell, and **Newest first** shows the latest scans at the top. On phones, and for sheets with more columns than fit, each row is one line: select it to see or change all of it.

The open tab updates live, so changes made in Google Sheets or by other people appear within seconds: Linework re-reads it every 5 seconds while the window has focus (15 seconds in the background, 30 seconds for two minutes after Google stops answering), and checks the spreadsheet's tabs every sixth time. Longer tabs are re-read less often (twice as long over 1,000 rows, four times over 2,500), since every read returns every row. It pauses while a cell or row is being edited or a dialog is open, so nothing you're typing is replaced. **Refresh** re-reads it right away.

Several people can scan into and edit the same tab at once without overwriting each other (`src/lib/sheets/live-write.js`):

- each scan becomes a new row below the last row with data, never on top of another row, and each value goes under its column's heading as it is in Google Sheets at that moment, so a column someone inserted or moved can't shift it; scans made in quick succession go in one request;
- column mappings follow their columns when someone inserts, moves, or deletes columns;
- before a row is edited or deleted, Linework checks that it still holds what was on screen. If rows were added or removed above it, the change follows the row; if someone else changed the same cell, nothing is written, the table shows the new value, and Linework says so.

Values are written with `RAW` input, so barcode text is never run as a formula. Numbers and `TRUE`/`FALSE` keep their cell types, and identifiers with leading zeros stay text. Linked URLs and column mappings stay in browser local storage. Scan history lasts for the current page session only. Double-click a cell in the table to edit it in place (Enter saves, Escape cancels).

### Change log and Migrate changes

Every change made through Linework is recorded in D1 for the person who made it, per spreadsheet (**Change log** above the table). If a row change — a scan, an added or edited row, or a deleted row — fails because Google Sheets can't be reached (network failure, timeout, rate limit, server error) or Google's session lapsed, it is stored as *pending* instead of being lost. If Linework's server can't be reached either, it waits in the browser and uploads later. Tab and column changes need the live spreadsheet and are never queued.

A banner then shows how many changes are stored. They are migrated **automatically** as soon as Google responds: Linework tries again after 2, 5, 10, 20, and then every 30 seconds, right after a change is stored, when the browser comes back online or to the foreground, and after you reconnect Google. A toast says when stored changes reached the spreadsheet, and the open tab reloads. **Migrate changes** (enabled while any are pending) does it right away. Automatic migration stops for a spreadsheet whose account can't edit it, and says so, until you migrate by hand or sign in again. Either way, changes are written oldest first, without conflicts:

- new rows are appended after the existing data, under the column with the same heading wherever it is now;
- an edit is applied only if the cell still holds the value it had when it was edited;
- edited or deleted rows are found by their contents, so rows added or removed since don't misdirect them;
- anything that can't be placed safely (for example a renamed column or a cell changed by someone else) is marked **Needs attention**, to retry or discard.

The server hands pending changes to one browser at a time (a claim with a 10-minute lease), so two windows never apply the same change; results that can't be reported are kept in the browser and sent before the next claim.

## Events, teams, and alerts

Anyone can create an **event** and becomes its owner. Roles apply inside that event only, and the Worker checks every request against them (`src/server/rbac.js`):

| | Owner | Organizer | Sub-team manager | Member |
| --- | --- | --- | --- | --- |
| See the event, its people and sub-teams | ✓ | ✓ | ✓ | ✓ |
| See documents | all | all | those for them | those for them |
| Edit details; add, remove, and change roles of people | ✓ | ✓ | | |
| Create sub-teams and choose their managers | ✓ | ✓ | | |
| Create, link, and re-scope documents | ✓ | ✓ | | |
| Send alerts and pages | anyone | anyone | their sub-teams' people | |
| Delete the event | ✓ | | | |

People are added by email, and see the event when they sign in with that Google account. A sub-team can be filled from one of your **teams** (anyone not yet in the event is added as a member). People outside an event get "not found", so events can't be probed for.

**Documents.** Organizers create Google Sheets or Docs from an event, for everyone, specific sub-teams, or organizers only, with edit or view access. Linework creates the file in the organizer's Drive (`drive.file` scope) and shares it with exactly those people; Google emails each of them a link. When people, roles, sub-teams, or a document's audience change, the server works out the sharing changes and the creator's browser applies them in Drive (Linework's Drive access covers only files it created for that person). Shares that fail, such as an address with no Google account, are listed with Google's reason and a **Retry sharing** button. Sharing that is still to be done (for example after someone is added while the creator is offline) is applied in the background whenever the creator has Linework open, within about a minute. An open event re-reads its documents, people, sub-teams, and alerts every 15 seconds. Existing files can be linked too; their sharing stays as their owner set it. Sheets open in Linework's editor, where Google's own permissions apply.

**Alerts.** A *notice* appears in the recipients' alerts list and as a notification; a *page* fills their screen until they acknowledge it, with vibration and a tone where allowed. Senders and organizers see who has acknowledged. Alerts are delivered by Web Push (RFC 8291 encryption, RFC 8292 VAPID) to every browser where the recipient turned notifications on, and through Expo's push service (Apple's and Google's underneath) to every phone with the app and notifications on; open pages poll every 20 seconds. App pages use Android's high-priority "Pages" channel and iOS time-sensitive delivery. Expired app push tokens are removed when Expo reports them. Push addresses must belong to a browser push service. Each sender can send 10 alerts a minute. On iPhone and iPad, notifications need Linework added to the Home Screen.

## Barcode decoding

Barcodes are decoded by [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), a WebAssembly build of ZXing-C++, which reads QR Code, Data Matrix, Aztec, PDF417, MaxiCode, EAN/UPC, Code 128, Code 39, Code 93, Codabar, ITF, DataBar and more. No license key is needed.

Where the browser has a built-in barcode detector (Chrome on Android, ChromeOS, and macOS), the camera uses it for most frames: it reads a frame in a few milliseconds. zxing-wasm runs in a Web Worker (`src/lib/scanner/zxing.worker.js`) so the preview stays smooth, alternating a quick read of the middle of the frame at full resolution with a thorough read of the whole frame (rotated, light-on-dark, and small codes); with the built-in detector it still takes every fourth frame. One frame is read at a time, so slower devices simply read less often. Codes without a check digit (Code 39, Codabar, ITF) are accepted only once two frames agree, which avoids misreads. Continuous autofocus is turned on where the camera supports it, and a **Zoom** slider appears for cameras that can zoom. Uploaded images are decoded by the browser first, so any format it can display works and EXIF rotation is respected. The WASM file is bundled with the app instead of being fetched from zxing-wasm's default CDN.

## Deploy to Cloudflare Workers

Once, before the first deploy with the server:

```sh
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the value from .dev.vars
```

Then:

```sh
npm run deploy
```

This checks, tests, and builds, applies any new migrations (such as `0002_native_push.sql` for the app's push tokens) to the `linework` D1 database, then publishes the Worker with `dist/` as static assets (see `wrangler.toml`). The Worker answers `/api/*`, redirects the legacy `workers.dev` hostname, and serves everything else from the assets. `public/_headers` sets long-lived caching for hashed assets, no caching for the service worker, and basic security headers, including a camera permission policy.

## Project structure

```
migrations/                        D1 schema
public/sw.js, manifest.webmanifest service worker (push notifications) and install manifest
scripts/                           dev runner (Vite + wrangler), VAPID key generator
src/
  worker.js                        Worker entry: legacy redirect, /api, static assets
  server/
    api.js, http.js, validate.js   router, origin check, JSON bodies, input validation
    session.js                     Google token verification and sessions
    rbac.js                        event roles and permissions (pure functions)
    push.js                        encrypted Web Push delivery
    native-push.js                 app notifications through Expo's push service
    routes/                        session, teams, events, docs, alerts, push, changes
    testing/                       in-memory D1 (Node SQLite) and API test harness
  main.js, App.svelte, app.css     entry point, layout switch, design tokens
  lib/
    config.js, env.d.ts            .env configuration
    storage.js, format.js, focus.js local storage, formatting, dialog focus
    motion.js                      GSAP attachments (reduced-motion aware)
    ribbons/                       GSAP-animated canvas ribbons for the welcome screen
    feedback.js, sheet-actions.js  error toasts; dialog-driven sheet flows
    navigation.js, people.js       opening sheets from events; parsing pasted email lists
    session-lifecycle.js           what starts after sign-in and stops at sign-out
    api/client.js                  Linework API client
    changes/outbox.js              changes waiting in the browser for the server
    changes/auto-sync.js           retry schedule for migrating stored changes automatically
    barcode/fields.js              payload parsing and typed field extraction
    sheets/                        spreadsheet IDs, A1 ranges, cell typing; migrating stored changes
    google/                        Google Identity Services, Sheets and Drive REST clients
    scanner/                       zxing-wasm worker, camera scanner, image scanner
    stores/                        Svelte 5 rune stores: auth, account (server session), workspace,
                                   changes, events, teams, alerts, notifications, session, camera,
                                   settings, dialogs, toast, layout
  components/
    ui/                            Button, Modal, dialogs, Tabs, Pill, PeoplePicker, Toast, …
    brand/, illustrations/         marks, ribbon canvas, home screen animations
    capture/, results/, history/   scanning, decoded results, session history
    sheets/, changes/              spreadsheet editor; change log and Migrate changes
    events/, teams/, people/       event pages and dialogs; teams; adding people
    alerts/                        full-screen page, alerts list, notification toggle
    settings/                      settings and account dialogs
  views/
    desktop/                       top bar with Scanner, Events, and Teams sections
    mobile/                        welcome, home, sheet chooser, workspace, events, teams
```

Unit tests sit next to the modules they cover (`*.test.js`).

## Privacy

Barcode values alone do not reveal product names or prices; retail codes are shown as identifiers. Images are decoded in the browser and never uploaded. Mapped values are sent to the Google Sheet you choose, and only while automatic recording is on; each change is also recorded in your own change log on Linework's server. See `public/privacy.html` for what the server stores.
