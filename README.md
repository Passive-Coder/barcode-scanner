# Linework barcode scanner

A browser based barcode scanner built with the supplied Dynamsoft Barcode Reader JS 11.6.3200 package. Scan with a camera or select an image. The app shows the decoded value, barcode format, byte size, capture source and time, plus basic interpretation of URLs, email addresses, phone numbers, Wi-Fi codes, contacts, and retail identifiers. Scan history remains in memory for the current page session.

## Run locally

Serve the repository root over HTTP and open the printed URL:

```sh
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). Camera access requires localhost or HTTPS. Image scanning works without a camera. The scanner SDK's runtime assets are included under `vendor/dynamsoft` and must be served along with the app.

## License

Dynamsoft requires a valid license to decode barcodes. This app initially uses the sample key found in the supplied package. If it expires, open the gear icon in the app, enter your own Dynamsoft license key, and save. The key is stored in this browser's local storage. License verification may require network access to Dynamsoft.

## Structure

- `index.html`: semantic app shell
- `src/app.js`: interface and session state
- `src/scanner.js`: Dynamsoft camera and image capture
- `src/interpret.js`: safe, local interpretation of common payloads
- `src/styles.css`: responsive interface
- `vendor/dynamsoft`: supplied SDK runtime and legal notices

Barcode values alone do not contain product names or prices; retail codes are shown as identifiers. No image or decoded result is sent to an application server.
