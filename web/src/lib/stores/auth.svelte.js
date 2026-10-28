import { nameFromEmail } from "../format.js";
import { fetchProfile, loadGoogleIdentity, requestAccessToken, revokeAccessToken } from "../google/identity.js";
import { SheetsAuthError } from "../google/sheets-client.js";
import { settings } from "./settings.svelte.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SCOPES = [
  SHEETS_SCOPE,
  "https://www.googleapis.com/auth/userinfo.email",
  // Needed for the greeting's first name; without it the userinfo endpoint returns only the email.
  "https://www.googleapis.com/auth/userinfo.profile",
];
/** Treat the token as expired slightly early so an in-flight request never races the deadline. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Google sign-in state. The access token lives only in memory: a reload signs the person out,
 * and an expired token moves the state to "expired" so the UI can offer a one-click reconnect
 * without losing the current workspace.
 */
class AuthStore {
  /** @type {"signed-out" | "connecting" | "connected" | "expired"} */
  status = $state("signed-out");
  email = $state("");
  name = $state("");
  /** True while an expired session signs back in to the same account. */
  reconnecting = $state(false);
  /** Scopes granted to the current token. Drive access is asked for only when it's needed. */
  scopes = $state.raw(/** @type {string[]} */ ([]));
  #token = "";
  #expiresAt = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #expiryTimer;
  /** @type {Promise<void> | undefined} */
  #connecting;

  get connected() {
    return this.status === "connected";
  }

  get displayName() {
    return this.name || nameFromEmail(this.email) || "there";
  }

  /** Loads Google's script ahead of time so the sign-in popup opens promptly after a click. */
  preload() {
    loadGoogleIdentity().catch(() => {});
  }

  connect() {
    this.#connecting ??= this.#connect().finally(() => {
      this.#connecting = undefined;
    });
    return this.#connecting;
  }

  async #connect() {
    const clientId = settings.clientId;
    if (!clientId) throw new Error("Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in .env or add a client ID in Settings.");
    const previous = this.status;
    const reconnecting = previous === "expired" && Boolean(this.email);
    this.reconnecting = reconnecting;
    this.status = "connecting";
    try {
      const response = await requestAccessToken({
        clientId,
        scopes: SCOPES,
        requiredScopes: [SHEETS_SCOPE],
        // An expired session reconnects silently to the same account; otherwise let the person choose.
        prompt: reconnecting ? "" : "select_account",
        loginHint: reconnecting ? this.email : undefined,
      });
      this.#accept(response);
    } catch (error) {
      this.status = previous;
      this.reconnecting = false;
      throw error;
    }
    if (!reconnecting) {
      // A person may choose a different Google account; discard the previous profile.
      this.email = "";
      this.name = "";
    }
    try {
      const profile = await fetchProfile(this.#token);
      this.email = profile.email;
      this.name = profile.name;
    } catch (error) {
      console.warn("Signed in without profile details.", error);
    }
    this.status = "connected";
    this.reconnecting = false;
  }

  /** @param {import("../google/identity.js").TokenResponse} response */
  #accept(response) {
    this.#token = response.access_token;
    this.#expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
    this.scopes = String(response.scope ?? "").split(" ").filter(Boolean);
    this.#scheduleExpiry();
  }

  /** @param {string} scope */
  hasScope(scope) {
    return this.connected && this.scopes.includes(scope);
  }

  /**
   * Asks the signed-in person for one more permission (for example Google Drive), keeping
   * the ones already granted. Must run from a click, because Google shows a popup.
   * @param {string} scope
   */
  async grant(scope) {
    if (this.hasScope(scope)) return;
    if (!this.connected) throw new SheetsAuthError("Connect Google first.");
    const response = await requestAccessToken({
      clientId: settings.clientId,
      scopes: [...SCOPES, scope],
      requiredScopes: [SHEETS_SCOPE, scope],
      prompt: "",
      loginHint: this.email,
    });
    const profile = await fetchProfile(response.access_token).catch(() => null);
    if (profile && this.email && profile.email.toLowerCase() !== this.email.toLowerCase()) {
      revokeAccessToken(response.access_token);
      throw new Error(`Choose ${this.email} in Google's window to give Linework access.`);
    }
    this.#accept(response);
  }

  #scheduleExpiry() {
    clearTimeout(this.#expiryTimer);
    this.#expiryTimer = setTimeout(() => this.expire(), Math.max(0, this.#expiresAt - Date.now() - EXPIRY_MARGIN_MS));
  }

  /** Returns a live access token or throws if the session has lapsed. */
  token() {
    if (this.status === "connected" && Date.now() >= this.#expiresAt - EXPIRY_MARGIN_MS) this.expire();
    if (this.status !== "connected") {
      throw new SheetsAuthError(this.status === "expired" ? "Your Google session expired. Reconnect Google to continue." : "Connect Google first.");
    }
    return this.#token;
  }

  expire() {
    clearTimeout(this.#expiryTimer);
    this.#token = "";
    if (this.status === "connected") this.status = "expired";
  }

  disconnect() {
    clearTimeout(this.#expiryTimer);
    if (this.#token) revokeAccessToken(this.#token);
    this.#token = "";
    this.#expiresAt = 0;
    this.email = "";
    this.name = "";
    this.scopes = [];
    this.status = "signed-out";
  }
}

export const auth = new AuthStore();
