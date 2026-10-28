/**
 * Thin wrapper around Google Identity Services' token model. The script is loaded on demand
 * (and preloaded at startup) instead of from index.html, so sign-in can await it reliably.
 */
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
/** Generous enough for a first-time consent screen, short enough to recover from a lost popup. */
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

/** @type {Promise<any> | undefined} */
let loading;

/** @returns {Promise<any>} google.accounts.oauth2 */
export function loadGoogleIdentity() {
  const ready = /** @type {any} */ (window).google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => {
      const oauth2 = /** @type {any} */ (window).google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("Google sign-in did not initialise. Reload the page and try again."));
    };
    script.onerror = () => {
      script.remove();
      loading = undefined;
      reject(new Error("Google sign-in could not load. Check your connection or content blockers and try again."));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * @typedef {{ access_token: string, expires_in: number | string, scope: string }} TokenResponse
 * @param {{ clientId: string, scopes: string[], requiredScopes: string[], prompt: string, loginHint?: string }} options
 * @returns {Promise<TokenResponse>}
 */
export async function requestAccessToken({ clientId, scopes, requiredScopes, prompt, loginHint }) {
  const oauth2 = await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    let settled = false;
    /** @param {() => void} settle */
    const finish = (settle) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      settle();
    };
    const timeout = setTimeout(() => finish(() => reject(new Error("Google sign-in timed out. Please try again."))), SIGN_IN_TIMEOUT_MS);

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(" "),
      // Keep permissions granted earlier (such as Drive) in every new token.
      include_granted_scopes: true,
      login_hint: loginHint || undefined,
      /** @param {any} result */
      callback: (result) => {
        if (result?.error || !result?.access_token) {
          finish(() => reject(new Error(result?.error_description || result?.error || "Google sign-in was cancelled.")));
        } else if (!requiredScopes.every((scope) => oauth2.hasGrantedAllScopes(result, scope))) {
          const missing = requiredScopes.find((scope) => !oauth2.hasGrantedAllScopes(result, scope)) ?? "";
          finish(() =>
            reject(
              new Error(
                /drive/.test(missing)
                  ? "Google Drive access was not granted. Try again and allow Linework to create and share files in your Drive."
                  : "Google Sheets access was not granted. Sign in again and allow access to your spreadsheets.",
              ),
            ),
          );
        } else {
          finish(() => resolve(result));
        }
      },
      /** @param {any} error */
      error_callback: (error) => {
        const reason = String(error?.message || error?.type || "Google sign-in failed.");
        const message = /popup.*(closed|failed)/i.test(reason)
          ? "The Google sign-in window closed. If it closed immediately, allow pop-ups and check this site is an Authorized JavaScript origin."
          : reason;
        finish(() => reject(new Error(message)));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

/** @param {string} token */
export function revokeAccessToken(token) {
  /** @type {any} */ (window).google?.accounts?.oauth2?.revoke?.(token, () => {});
}

/**
 * @param {string} token
 * @returns {Promise<{ email: string, name: string }>}
 */
export async function fetchProfile(token) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Profile request failed (${response.status}).`);
  const profile = await response.json();
  return { email: profile.email ?? "", name: profile.given_name || profile.name || "" };
}
