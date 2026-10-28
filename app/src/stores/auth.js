import { nameFromEmail } from "../lib/format.js";
import * as google from "../lib/google/auth.js";
import { SheetsAuthError } from "../lib/google/sheets-client.js";
import { Store } from "../lib/store.js";

/**
 * Google sign-in state. On iOS and Android, Google's SDK keeps the person signed in between
 * launches and refreshes access tokens itself; tokens are fetched when needed, never stored by
 * Linework. (Mirrors web/src/lib/stores/auth.svelte.js.)
 */
class AuthStore extends Store {
  /** @type {"signed-out" | "restoring" | "connecting" | "connected" | "expired"} */
  status = "signed-out";
  email = "";
  name = "";
  /** @type {string[]} */
  scopes = [];
  /** @type {Promise<void> | undefined} */
  #connecting;

  get connected() {
    return this.status === "connected";
  }

  get displayName() {
    return this.name || nameFromEmail(this.email) || "there";
  }

  /** Why sign-in can't work in this build, or "". */
  get problem() {
    return google.configurationProblem();
  }

  /** @param {google.GoogleAccount} account */
  #accept(account) {
    this.email = account.email;
    this.name = account.name;
    this.scopes = account.scopes;
    this.status = "connected";
    this.changed();
  }

  /** At launch: signs back in silently if this device signed in before. */
  async restore() {
    this.status = "restoring";
    this.changed();
    const account = await google.restore();
    if (account) this.#accept(account);
    else {
      this.status = "signed-out";
      this.changed();
    }
  }

  connect() {
    this.#connecting ??= this.#connect().finally(() => {
      this.#connecting = undefined;
    });
    return this.#connecting;
  }

  async #connect() {
    const previous = this.status;
    const reconnecting = previous === "expired" && Boolean(this.email);
    this.status = "connecting";
    this.changed();
    try {
      this.#accept(await google.signIn({ loginHint: reconnecting ? this.email : undefined }));
    } catch (error) {
      this.status = previous === "restoring" ? "signed-out" : previous;
      this.changed();
      throw error;
    }
  }

  /** A live access token, or throws (and marks the session expired) if there isn't one. */
  async token() {
    if (this.status !== "connected") {
      throw new SheetsAuthError(this.status === "expired" ? "Your Google session expired. Reconnect Google to continue." : "Connect Google first.");
    }
    try {
      return await google.getAccessToken();
    } catch (error) {
      this.expire();
      throw error instanceof SheetsAuthError ? error : new SheetsAuthError("Your Google session expired. Reconnect Google to continue.");
    }
  }

  /** Google refused a token. @param {string} token @returns {Promise<boolean>} whether to try a fresh one */
  async refresh(token) {
    const retry = await google.refresh(token);
    if (!retry) this.expire();
    return retry;
  }

  /** @param {string} scope */
  hasScope(scope) {
    return this.connected && this.scopes.includes(scope);
  }

  /** Asks for one more permission, such as Google Drive. @param {string} scope */
  async grant(scope) {
    if (this.hasScope(scope)) return;
    if (!this.connected) throw new SheetsAuthError("Connect Google first.");
    this.scopes = await google.grant(scope);
    this.changed();
  }

  expire() {
    if (this.status !== "connected") return;
    this.status = "expired";
    this.changed();
  }

  async disconnect() {
    await google.signOut();
    this.email = "";
    this.name = "";
    this.scopes = [];
    this.status = "signed-out";
    this.changed();
  }
}

export const auth = new AuthStore();
