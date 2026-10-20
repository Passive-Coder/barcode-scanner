/**
 * Build-time configuration from `.env` (see `.env.example`).
 * Every VITE_ value is compiled into the public bundle, so none of these are secrets:
 * the browser OAuth flow needs only a client ID, never a client secret.
 */
const env = import.meta.env;

export const config = Object.freeze({
  googleClientId: (env.VITE_GOOGLE_CLIENT_ID ?? "").trim(),
});

if (env.DEV && !config.googleClientId) {
  console.warn("[linework] VITE_GOOGLE_CLIENT_ID is not set; Google sign-in needs a client ID from .env or Settings.");
}

export const GOOGLE_CLIENT_ID_PATTERN = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

/** Sheet reads are capped at this many rows to keep the table responsive. */
export const SHEET_ROW_LIMIT = 1000;
export const SESSION_HISTORY_LIMIT = 50;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Repeated camera reads of the same code within this window are treated as one scan. */
export const CAMERA_DUPLICATE_WINDOW_MS = 6000;
export const MOBILE_QUERY = "(max-width: 700px)";
