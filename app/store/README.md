# Google Play listing

Everything Play Console asks for when Linework is first published, ready to paste. Images are in this folder.

| Item | File or value |
| --- | --- |
| App bundle | `android/app/build/outputs/bundle/release/app-release.aab` (built by `./gradlew bundleRelease`, see `../README.md`) |
| App icon (512 × 512) | `icon-512.png` |
| Feature graphic (1024 × 500) | `feature-graphic.jpg` |
| Phone screenshots | `screenshots/phone-1.png` … `phone-5.png` (made-up sample data) |
| Privacy policy | https://linework.stucovitv.in/privacy |
| Website | https://linework.stucovitv.in |
| Category | Productivity |
| Contains ads | No |

## Store listing

**App name** (30 characters at most)

> Linework barcode scanner

**Short description** (80 at most)

> Scan barcodes into Google Sheets, and run events with your team.

**Full description**

> Linework scans barcodes and QR codes and records what's in them in a Google Sheet you choose.
>
> • Scan with the camera, or from a photo. Linework reads QR codes, Data Matrix, PDF417, Aztec, EAN and UPC, Code 128, Code 39 and more.
> • See every value inside a code: links and their parameters, Wi-Fi details, contacts, JSON, GS1 data, and labelled values.
> • Choose which value goes into each column, and every scan adds a row to your sheet.
> • Edit your spreadsheets: add, change, and delete rows, columns, and tabs. Changes made elsewhere appear within seconds.
> • No signal? Changes are kept and added to the sheet automatically as soon as Google can be reached, without overwriting anyone else's edits.
>
> For organisers, Linework runs events:
>
> • Add people by email, with organisers, members, and sub-teams with their own managers.
> • Create Google Sheets and Docs for the event; Linework shares each one with exactly the people it's for.
> • Send notices, or pages that fill everyone's screen until they acknowledge them, and see who has.
>
> Linework uses your Google account. It only opens the spreadsheets you choose and the files it creates for you, and it has no ads or tracking.

**Release notes** (first release)

> First release of Linework for Android.

## App content answers

**App access:** some functionality is restricted. Instructions for reviewers: "Sign in with any Google account. To try scanning into a sheet, create a Google Sheet in that account, then paste its link under Edit a spreadsheet → Add a spreadsheet." No special credentials are needed.

**Ads:** the app contains no ads.

**Target audience:** 18 and over (Linework is for student council and event organisers). Choosing an age group under 13 brings in Google's Families policy, which the app isn't built for.

**Content rating questionnaire:** category "All other app types". Answer no to violence, sexual content, profanity, drugs, gambling and similar questions. Answer **yes** to "users can interact or exchange content": people in an event see each other's names and email addresses and receive alerts from organisers. The app doesn't share the user's location and has no purchases.

**Data safety:**

| Data type | Collected | Why | Optional |
| --- | --- | --- | --- |
| Name, email address | Yes | App functionality, account management | No (needed to sign in) |
| User IDs (Google account ID) | Yes | Account management | No |
| Other user-generated content (events, teams, alerts, spreadsheet change log) | Yes | App functionality | Yes |
| Device or other IDs (push notification token) | Yes | App functionality (alerts) | Yes (only if notifications are turned on) |
| Photos, camera | No: images are read on the phone and never uploaded | | |

- Data is not shared with third parties. Values the person records go to their own Google Sheets at their request, which Play doesn't count as sharing.
- Data is encrypted in transit (HTTPS).
- People can ask for their data to be deleted: the privacy policy says how. They can also delete teams, leave events, and discard stored changes in the app.

**Contact email:** the address shown on the listing. The privacy policy currently lists passiveuser369@gmail.com.

## Before release

- **Google sign-in.** Google Play re-signs the app with its own key, so sign-in works only once that key is registered. In Play Console → Test and release → App integrity, copy the **App signing key certificate SHA-1**. Create an Android OAuth client for package `in.stucovitv.linework` with that SHA-1 in the same Google Cloud project, add its client ID to `GOOGLE_CLIENT_IDS` in `web/wrangler.toml`, and deploy the website. To try the signed APK before Play (`app-release.apk`), do the same with the upload key's SHA-1, `4B:02:46:4B:89:A6:41:8E:1A:0D:99:2C:59:82:86:83:06:CE:E1:23`.
- **Notifications.** This build can't receive push notifications until the app has an Expo project ID and Firebase setup (see `../README.md`). Alerts still appear while the app is open.
- **Production access.** New personal developer accounts must first run a closed test with at least 12 testers who stay opted in for 14 days in a row, then apply for production. Internal testing (up to 100 testers) is available straight away.
