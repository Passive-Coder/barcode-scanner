/**
 * Build-time configuration from `.env` (see `.env.example`). EXPO_PUBLIC_ values are compiled into
 * the app, so none of these are secrets. They must be read as `process.env.EXPO_PUBLIC_…`
 * literally for Expo to inline them.
 */
export const config = Object.freeze({
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || "https://linework.stucovitv.in").replace(/\/+$/, ""),
  googleWebClientId: (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "").trim(),
  googleIosClientId: (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim(),
  googleAndroidClientId: (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "").trim(),
  easProjectId: (process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "").trim(),
});

/** Rows read from a tab. The rows view only draws those on screen, so long sheets stay quick. */
export const SHEET_ROW_LIMIT = 5000;
export const SESSION_HISTORY_LIMIT = 50;
/** Repeated camera reads of the same code within this window are treated as one scan. */
export const CAMERA_DUPLICATE_WINDOW_MS = 6000;
