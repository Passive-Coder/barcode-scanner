# Linework app

The iOS and Android version of Linework, built with **Expo SDK 57** (React Native 0.86, expo-router). It mirrors the website in [`../web`](../web/README.md): the same features, the same stores and modules (`src/stores`, `src/lib`, `src/components`), and the same API.

## Getting started

```sh
npm install
cp .env.example .env     # fill in the values (see below)
npx expo run:ios         # or: npx expo run:android
```

Google sign-in and push notifications need native code, so use a development build (`expo run:*` or EAS), not Expo Go. `npm run web` starts a web build on port 8081 for quick checks.

| Script | What it does |
| --- | --- |
| `npm run check` | Type check (`tsc`, checkJs) |
| `npm test` | Logic tests (`node --test`) |
| `npm run bundle` | Bundles iOS and Android JavaScript into `dist-check/` to catch build errors |

## Setup

1. **Google OAuth clients**, in the same Google Cloud project as the website: the iOS client is registered for bundle ID `in.stucovitv.linework`, and the Android debug client is registered for package `in.stucovitv.linework` with this computer's debug signing certificate's SHA-1 (`A2:A8:DF:CC:E0:55:7A:81:12:40:23:EC:58:8D:B9:92:9A:D1:1F:2B`). Both IDs are in `.env.example` and the local `.env`. On Android, `plugins/withAndroidDebugKeystore.js` copies `~/.android/debug.keystore` into the generated project during prebuild; set `LINEWORK_ANDROID_DEBUG_KEYSTORE` to another path if needed. The key is local and is not committed. Android's native SDK finds its client by package and signing certificate, while `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is passed to `GoogleSignin.configure`; `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` lets the app detect missing Android setup. Before distributing a release build, register another Android client with that build's signing SHA-1 (including the Play App Signing certificate when distributing through Google Play).
2. Both mobile client IDs are in `GOOGLE_CLIENT_IDS` in `web/wrangler.toml`. Deploy the Worker to accept the app's sign-ins. The project's `spreadsheets` scope lets Linework read and edit linked Sheets; `drive.file` lets it create and share event Sheets and Docs. A separate Google Docs scope is unnecessary for the current app, which opens Docs in Google Docs rather than editing their contents through the Docs API.
3. **Push notifications**: run `npx eas init` and put the project ID in `EXPO_PUBLIC_EAS_PROJECT_ID`. For Android, add a Firebase `google-services.json` as the EAS file secret `GOOGLE_SERVICES_JSON` and upload its FCM key to Expo. If you turn on Expo's push security, set the Worker secret `EXPO_ACCESS_TOKEN`.
4. Production needs migration `0002_native_push.sql` applied (`npm run deploy` in `web/` does this).

`EXPO_PUBLIC_` values are compiled into the app; never put a secret there.

## Google Play release

Release builds are signed with Linework's upload key, which stays outside the repository: the keystore is `~/.linework/linework-upload.keystore`, and its location and passwords are the `LINEWORK_UPLOAD_*` properties in `~/.gradle/gradle.properties`. `plugins/withAndroidReleaseSigning.js` wires them into the generated Android project. Back both files up: Google Play only accepts updates signed with this key (a lost key can be reset through Play Console support).

```sh
npx expo prebuild --platform android --no-install
cd android
ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=<JDK 17> ./gradlew bundleRelease assembleRelease
```

The Play bundle is `android/app/build/outputs/bundle/release/app-release.aab`, and an installable APK signed the same way is under `outputs/apk/release/`. Raise `android.versionCode` in `app.config.js` for every upload. The listing text, images, and Play Console answers are in [`store/`](store/README.md), including the Google sign-in step needed after the first upload.

## Notes

- Stored changes migrate to Google Sheets automatically as soon as Google responds; the open tab refreshes every few seconds, and open events every 15 seconds.
- Scans and edits are safe while others edit the same tab: scans go below the last row under their columns' current headings, and edits check the row first (shared with the website: `src/lib/sheets/live-write.js`). The rows list draws only what's on screen, with search and newest-first order, for tabs of up to 5,000 rows.
- Codes without a check digit (Code 39, Codabar, ITF) count once two camera frames agree; **Zoom in** helps with small or distant codes.
- On iPhone, scanning from a photo reads QR codes only (an iOS limitation); the camera reads every supported format.
- `npm audit` reports issues in Expo's build tooling only; none has a fix compatible with SDK 57.
