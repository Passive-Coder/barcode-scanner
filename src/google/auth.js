const CLIENT_ID_STORAGE_KEY = "linework-dedicated-google-client-id";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export class GoogleAuth {
  constructor() {
    this.clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY) || "";
    this.accessToken = null;
    this.expiresAt = 0;
    this.email = "";
  }

  get connected() {
    return Boolean(this.accessToken && Date.now() < this.expiresAt - 30_000);
  }

  getToken() {
    if (!this.connected) {
      this.accessToken = null;
      throw new Error("Google access has expired. Select Connect Google to sign in again.");
    }
    return this.accessToken;
  }

  setClientId(value) {
    const next = value.trim();
    if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(next)) {
      throw new Error("Enter a valid Google OAuth Web Client ID.");
    }
    if (next !== this.clientId) this.disconnect();
    this.clientId = next;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
  }

  async connect() {
    if (!this.clientId) {
      throw new Error("Add the dedicated Linework Google OAuth Web Client ID in Settings before connecting.");
    }
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google sign-in did not load. Check your connection and try again.");
    }

    const response = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const timeout = setTimeout(() => finish(reject, new Error("Google sign-in timed out. Please try again.")), 120_000);
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: `${SHEETS_SCOPE} ${EMAIL_SCOPE}`,
        callback: (result) => {
          if (result?.error || !result?.access_token) {
            finish(reject, new Error(result?.error_description || result?.error || "Google sign-in was cancelled."));
            return;
          }
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(result, SHEETS_SCOPE)) {
            finish(reject, new Error("Google Sheets access was not granted."));
            return;
          }
          finish(resolve, result);
        },
        error_callback: (error) => {
          const reason = error?.message || error?.type || "Google sign-in failed.";
          const message = /popup.*closed/i.test(reason)
            ? "Google sign-in window closed. If it closed immediately, check this website's Authorized JavaScript origin in Google Cloud."
            : reason;
          finish(reject, new Error(message));
        },
      });
      client.requestAccessToken({ prompt: "consent" });
    });

    this.accessToken = response.access_token;
    this.expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
    this.email = "";
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) this.email = (await res.json()).email || "";
    } catch { /* The Sheets token remains usable without a display email. */ }
    return this.email;
  }

  disconnect() {
    const token = this.accessToken;
    this.accessToken = null;
    this.expiresAt = 0;
    this.email = "";
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
  }
}
