import { ApiError, api, handleSessionLoss } from "../api/client.js";
import { auth } from "./auth.svelte.js";

/**
 * The Linework server session, which events, teams, alerts, and the change log need. It is
 * opened with the Google sign-in the browser already has, and ends on sign-out. Linework keeps
 * working with Google directly if the server can't be reached.
 *
 * @typedef {{ id: string, email: string, name: string }} AccountUser
 */
class AccountStore {
  /** @type {"signed-out" | "connecting" | "ready" | "unavailable"} */
  status = $state("signed-out");
  /** @type {AccountUser | null} */
  user = $state.raw(null);
  /** Public key push services use to check alerts come from this server. */
  vapidPublicKey = $state("");
  /** Why the server couldn't be used, when status is "unavailable". */
  problem = $state("");

  ready = $derived(this.status === "ready");

  /** @type {Promise<boolean> | undefined} */
  #starting;
  /** @type {Array<() => unknown>} */
  #readyListeners = [];
  /** @type {Array<() => unknown>} */
  #endListeners = [];

  constructor() {
    // A session that lapses (after 12 hours) is reopened silently while Google is connected.
    handleSessionLoss(() => {
      if (this.status !== "ready") return;
      this.status = "signed-out";
      this.user = null;
      if (auth.connected) void this.start();
    });
  }

  /** @param {() => unknown} listener runs each time a session opens */
  onReady(listener) {
    this.#readyListeners.push(listener);
  }

  /** @param {() => unknown} listener runs (and is awaited) before the session ends */
  onEnd(listener) {
    this.#endListeners.push(listener);
  }

  /** Opens a session for the signed-in Google account. Never throws. */
  start() {
    this.#starting ??= this.#start().finally(() => {
      this.#starting = undefined;
    });
    return this.#starting;
  }

  /** Resolves true once a session is open, starting one if Google is connected. */
  async ensure() {
    if (this.ready) return true;
    if (!auth.connected) return false;
    return this.start();
  }

  async #start() {
    this.status = "connecting";
    this.problem = "";
    try {
      const result = await api.post("/session", { accessToken: auth.token() });
      // The person may have signed out while the request was in flight.
      if (!auth.connected && auth.status !== "expired") {
        this.status = "signed-out";
        return false;
      }
      this.user = result.user;
      this.vapidPublicKey = result.vapidPublicKey ?? "";
      this.status = "ready";
    } catch (error) {
      console.warn("Linework server session unavailable.", error);
      this.status = "unavailable";
      this.problem = error instanceof ApiError || error instanceof Error ? error.message : "";
      return false;
    }
    for (const listener of this.#readyListeners) {
      try {
        await listener();
      } catch (error) {
        console.warn("Could not finish setting up after sign-in.", error);
      }
    }
    return true;
  }

  /**
   * Ends the session. Sign-out tasks run first, while the session still works, so they can
   * for example forget this device for alerts (they can check `ready`).
   */
  async end() {
    await Promise.allSettled(this.#endListeners.map((listener) => listener()));
    this.status = "signed-out";
    this.user = null;
    await api.delete("/session").catch(() => {});
  }
}

export const account = new AccountStore();
