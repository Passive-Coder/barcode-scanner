import { createApi } from "../api.js";
import { HttpError } from "../http.js";
import { createTestDatabase } from "./d1.js";

export const ORIGIN = "https://linework.test";

/**
 * A Linework API backed by an in-memory database, with Google sign-in and push delivery
 * replaced by fakes. `signIn("alice")` returns a client for alice@example.com.
 */
export function createHarness() {
  const db = createTestDatabase();
  let clock = Date.parse("2026-10-20T09:00:00Z");
  /** @type {Array<{ subscriptions: any[], message: any, options: any }>} */
  const pushes = [];
  /** @type {Promise<unknown>[]} */
  const background = [];

  const api = createApi({
    now: () => clock,
    // Tokens look like "token:<name>"; anything else is refused, like a token for another app.
    async verifyToken(token) {
      const name = token.startsWith("token:") ? token.slice(6) : "";
      if (!name) throw new HttpError(401, "Google didn't accept this sign-in. Sign in again.");
      return { sub: `sub-${name}`, email: `${name}@example.com`, name: name[0].toUpperCase() + name.slice(1) };
    },
    async sendPush(_env, subscriptions, message, options) {
      pushes.push({ subscriptions, message, options });
      return subscriptions.filter((subscription) => subscription.endpoint.includes("gone")).map((subscription) => subscription.endpoint);
    },
  });

  const env = {
    DB: db,
    GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
    APP_ORIGINS: "http://localhost:3000",
    VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "https://linework.test",
  };

  /**
   * @param {string} method @param {string} path @param {unknown} [body]
   * @param {{ cookie?: string, headers?: Record<string, string> }} [options]
   */
  async function send(method, path, body, { cookie = "", headers = {} } = {}) {
    const response = await api(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          Origin: ORIGIN,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      /** @type {any} */ (env),
      { waitUntil: (promise) => void background.push(promise) },
    );
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  }

  /** @param {string} name */
  async function signIn(name) {
    const response = await send("POST", "/api/session", { accessToken: `token:${name}` });
    if (response.status !== 200) throw new Error(`Sign-in failed: ${JSON.stringify(response.data)}`);
    const cookie = /** @type {string} */ (response.headers.get("Set-Cookie")).split(";")[0];
    const email = `${name}@example.com`;
    return {
      email,
      user: response.data.user,
      cookie,
      /** @param {string} path */
      get: (path) => send("GET", path, undefined, { cookie }),
      /** @param {string} path @param {unknown} [body] */
      post: (path, body = {}) => send("POST", path, body, { cookie }),
      /** @param {string} path @param {unknown} [body] */
      patch: (path, body = {}) => send("PATCH", path, body, { cookie }),
      /** @param {string} path */
      delete: (path) => send("DELETE", path, undefined, { cookie }),
    };
  }

  return {
    db,
    env,
    send,
    signIn,
    pushes,
    /** Waits for work the API continued after responding, such as push delivery. */
    settle: () => Promise.all(background.splice(0)),
    /** @param {number} ms */
    advance: (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
}
