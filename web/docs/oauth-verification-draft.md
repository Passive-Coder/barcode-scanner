# Google OAuth verification draft — Linework

Project: `perfect-nature-463213-t8`  
Consent app name: `stucovitv.in`  
Product: Linework barcode scanner  
Homepage: `https://linework.stucovitv.in/`  
Privacy policy: `https://linework.stucovitv.in/privacy.html`

This is copy for the Google Auth Platform verification form. Confirm the live homepage, privacy page, configured scopes, and project branding in Google Cloud before submitting. The demo video URL is still needed.

## App description

Linework scans barcodes on a user's device, lets the user choose a Google spreadsheet they can already access, and records selected barcode fields in that spreadsheet. Users can also inspect and edit its rows and tabs. Organizers can manage events, people, documents, and alerts. Google Sheets data is shown only to the signed-in user in the app and is used for the spreadsheet actions that user requests.

## Scope justification: `https://www.googleapis.com/auth/spreadsheets`

Users paste a link to an existing Google spreadsheet that their account can open. Linework reads its tab names and rows so they can select a tab, map barcode fields to columns, and see the current data. When the user enables recording, Linework appends a row for each scan; it also supports user-requested edits to cells, rows, columns, and tabs. Read-only Sheets access cannot perform these writes. `drive.file` alone does not cover arbitrary pre-existing spreadsheets opened by URL in this workflow. Linework uses the signed-in user's token and Google enforces that user's existing access to each spreadsheet. The app does not search or enumerate the user's spreadsheets.

## Scope justification: `https://www.googleapis.com/auth/drive.file`

This permission is requested separately when an event organizer creates a Google Sheet or Doc from Linework. Linework creates that file in the organizer's Drive and, when the organizer chooses people and access levels for the event, creates, updates, or removes permissions on that app-created file. It does not request broader Drive access. A metadata-only or read-only scope cannot create files or manage their sharing permissions.

## Basic identity

The website requests `userinfo.email` and `userinfo.profile` to identify the signed-in account, display its name, and associate that account with event membership and its Linework data. Native Google Sign-In supplies the account's email and basic profile. The server briefly uses the Google access token at sign-in to confirm identity, then stores its own session token hash instead of the Google token.

## Demo video checklist

1. Show the same `stucovitv.in` branding and Linework app submitted for review. Record the full Google account chooser and consent screen in English, with every requested scope visible.
2. Open an existing spreadsheet by link, choose a tab, scan a sample barcode, map fields to columns, record a scan, and show the resulting row in Google Sheets. Show a user-requested edit if the form asks how write access is used.
3. Create an event Sheet or Doc, show the separate Drive permission prompt, and show the file being created and shared with an event person. If only the Sheets scope is being verified, confirm with Google whether this additional flow is needed.
4. Show the privacy policy link and how to sign out. Host the recording at an accessible YouTube URL and add it to the form.

Google's [verification requirements](https://support.google.com/cloud/answer/13464321) call for an end-to-end demo with the complete OAuth consent screen, the same app branding and scopes, and the functionality using each requested scope. They also require a detailed explanation of why narrower scopes do not work.

## Before submission

- Check the exact scopes and branding currently configured in the Cloud project; this draft reflects the repository.
- Check that the public homepage and privacy policy match the consent screen and are reachable.
- Add the demo video link. Google Cloud Console was unreachable during drafting, so nothing has been entered or submitted there.
