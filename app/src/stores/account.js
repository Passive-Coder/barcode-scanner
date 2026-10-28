import { ApiError, ApiUnavailableError, api, connectSession } from "../lib/api/client.js";
import { errorMessage } from "../lib/format.js";
import { readSessionToken, writeSessionToken } from "../lib/secure.js";
import { Store } from "../lib/store.js";
import { auth } from "./auth.js";

/**
 * A session the server rejects this soon after opening it can't be fixed by opening another, so
 * the app stops there instead of trying again and again.
 */
const SHORTEST_SESSION_MS = 60_000;

/**
 * The Linework server session, which events, teams, alerts, and the change log need. It's opened
 * with the person's Google sign-in and kept (as a bearer token in the device's secure storage) for
 * 30 days, so alerts and events work right away at launch. (Mirrors account.svelte.js.)
 *
 * @typedef {{ id: string, email: string, name: string }} AccountUser
 */
class AccountStore extends Store {
  /** @type {"signed-out" | "connecting" | "ready" | "unavailable"} */
  status = "signed-out";
  /** @type {AccountUser | null} */
  user = null;
  /** Why the server couldn't be used, when status is "unavailable". */
  problem = "";
  #token = "";
  #readySince = 0;
  /** @type {Promise<boolean> | undefined} */
  #starting;
  /** @type {Array<() => unknown>} */
  #readyListeners = [];
  /** @type {Array<() => unknown>} */
  #endListeners = [];

  constructor() {
    super();
    connectSession({ token: () => this.#token, onLost: () => this.#lost() });
  }

  get ready() {
    return this.status === "ready";
  }

  /** @param {() => unknown} listener runs each time a session opens */
  onReady(listener) {
    this.#readyListeners.push(listener);
  }

  /** @param {() => unknown} listener runs (and is awaited) before the session ends */
  onEnd(listener) {
    this.#endListeners.push(listener);
  }

  /** @param {string} token @param {AccountUser} user */
  async #open(token, user) {
    this.#token = token;
    this.user = user;
    this.problem = "";
    this.#readySince = Date.now();
    this.status = "ready";
    this.changed();
    for (const listener of this.#readyListeners) {
      try {
        await listener();
      } catch (error) {
        console.warn("Could not finish setting up after sign-in.", error);
      }
    }
  }

  /** @param {unknown} error */
  #unavailable(error) {
    console.warn("Linework server session unavailable.", error);
    this.status = "unavailable";
    this.problem = errorMessage(error);
    this.changed();
  }

  /** At launch: reopens the session kept on this device, if it's still valid. */
  async restore() {
    const token = await readSessionToken();
    if (!token) return false;
    this.status = "connecting";
    this.changed();
    try {
      const { user } = await api.get("/session", token);
      await this.#open(token, user);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        await writeSessionToken("");
        this.status = "signed-out";
        this.changed();
      } else {
        // Offline at launch: keep the token and try again when the server can be reached.
        this.#token = token;
        this.#unavailable(error);
      }
      return false;
    }
  }

  /** Opens a session for the signed-in Google account. Never throws. */
  start() {
    this.#starting ??= this.#start().finally(() => {
      this.#starting = undefined;
    });
    return this.#starting;
  }

  async #start() {
    this.status = "connecting";
    this.problem = "";
    this.changed();
    try {
      const result = await api.post("/session", { accessToken: await auth.token(), tokenType: "bearer" });
      await writeSessionToken(result.token);
      await this.#open(result.token, result.user);
      return true;
    } catch (error) {
      this.#unavailable(error);
      return false;
    }
  }

  /** Resolves true once a session is open: reopening a kept one, or starting one with Google. */
  async ensure() {
    if (this.ready) return true;
    if (this.#token && (await this.restoreKept())) return true;
    if (!auth.connected) return false;
    return this.start();
  }

  /** Retries a kept session that couldn't be checked (for example the phone was offline). */
  async restoreKept() {
    if (!this.#token) return false;
    try {
      const { user } = await api.get("/session", this.#token);
      await this.#open(this.#token, user);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        this.#token = "";
        await writeSessionToken("");
      } else if (!(error instanceof ApiUnavailableError)) console.warn(error);
      return false;
    }
  }

  #lost() {
    if (this.status !== "ready") return;
    this.user = null;
    this.#token = "";
    void writeSessionToken("");
    if (Date.now() - this.#readySince < SHORTEST_SESSION_MS) {
      this.status = "unavailable";
      this.problem = "Linework couldn't keep you signed in. Sign out and in again.";
      this.changed();
      return;
    }
    this.status = "signed-out";
    this.changed();
    if (auth.connected) void this.start();
  }

  /** Ends the session after running sign-out tasks (which can still use it). */
  async end() {
    await Promise.allSettled(this.#endListeners.map((listener) => listener()));
    if (this.#token) await api.delete("/session").catch(() => {});
    this.#token = "";
    await writeSessionToken("");
    this.user = null;
    this.status = "signed-out";
    this.changed();
  }
}

export const account = new AccountStore();
