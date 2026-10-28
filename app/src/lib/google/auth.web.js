import { config } from "../config.js";
import { SheetsAuthError } from "./sheets-client.js";

/**
 * Google sign-in for the app's web build, through Google Identity Services' token flow (as on the
 * website, web/src/lib/google/identity.js). Exports the same functions as auth.js.
 *
 * @typedef {import("./auth.js").GoogleAccount} GoogleAccount
 */

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SIGN_IN_SCOPES = [SHEETS_SCOPE, "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
/** Treat the token as expired slightly early so a request never races the deadline. */
const EXPIRY_MARGIN_MS = 60_000;

let token = "";
let expiresAt = 0;
let email = "";
/** @type {string[]} */
let scopes = [];
/** @type {Promise<any> | undefined} */
let loading;

/** Why Google sign-in can't work in this build, or "" if it can. */
export function configurationProblem() {
  return config.googleWebClientId ? "" : "Google sign-in isn't set up yet (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing).";
}

/** @returns {Promise<any>} google.accounts.oauth2 */
function loadGoogleIdentity() {
  const ready = /** @type {any} */ (window).google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => {
      const oauth2 = /** @type {any} */ (window).google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("Google sign-in did not initialise. Reload and try again."));
    };
    script.onerror = () => {
      script.remove();
      loading = undefined;
      reject(new Error("Google sign-in could not load. Check your connection and try again."));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * @param {{ scopes: string[], required: string[], prompt: string, loginHint?: string }} options
 * @returns {Promise<{ access_token: string, expires_in: number | string, scope: string }>}
 */
async function requestToken({ scopes: wanted, required, prompt, loginHint }) {
  const oauth2 = await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: config.googleWebClientId,
      scope: wanted.join(" "),
      include_granted_scopes: true,
      login_hint: loginHint || undefined,
      /** @param {any} result */
      callback: (result) => {
        if (result?.error || !result?.access_token) reject(new Error(result?.error_description || result?.error || "Google sign-in was cancelled."));
        else if (!required.every((scope) => oauth2.hasGrantedAllScopes(result, scope))) reject(new Error("The permission Linework asked for wasn't granted. Try again and allow it."));
        else resolve(result);
      },
      /** @param {any} error */
      error_callback: (error) => reject(new Error(String(error?.message || error?.type || "Google sign-in failed."))),
    });
    client.requestAccessToken({ prompt });
  });
}

/** @param {{ access_token: string, expires_in: number | string, scope: string }} response */
function accept(response) {
  token = response.access_token;
  expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
  scopes = String(response.scope ?? "").split(" ").filter(Boolean);
}

/** @param {{ loginHint?: string }} [options] @returns {Promise<GoogleAccount>} */
export async function signIn({ loginHint } = {}) {
  const problem = configurationProblem();
  if (problem) throw new Error(problem);
  accept(await requestToken({ scopes: SIGN_IN_SCOPES, required: [SHEETS_SCOPE], prompt: loginHint ? "" : "select_account", loginHint }));
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token}` } });
  const profile = response.ok ? await response.json() : {};
  email = profile.email ?? "";
  return { email, name: profile.given_name || profile.name || "", scopes };
}

/** Browsers can't sign back in without the person; the app asks them to. */
export async function restore() {
  return null;
}

export async function getAccessToken() {
  if (!token || Date.now() >= expiresAt - EXPIRY_MARGIN_MS) throw new SheetsAuthError("Your Google session expired. Reconnect Google to continue.");
  return token;
}

/** A refused token can't be replaced without the person in a browser. @param {string} _token */
export async function refresh(_token) {
  token = "";
  return false;
}

/** @param {string} scope @returns {Promise<string[]>} */
export async function grant(scope) {
  accept(await requestToken({ scopes: [...SIGN_IN_SCOPES, scope], required: [SHEETS_SCOPE, scope], prompt: "", loginHint: email }));
  return scopes;
}

export async function signOut() {
  if (token) /** @type {any} */ (window).google?.accounts?.oauth2?.revoke?.(token, () => {});
  token = "";
  expiresAt = 0;
  email = "";
  scopes = [];
}
