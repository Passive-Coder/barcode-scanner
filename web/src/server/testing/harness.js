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
  /** @type {Array<{ tokens: string[], message: any, options: any }>} */
  const appPushes = [];
  /** @type {Promise<unknown>[]} */
  const background = [];

  const api = createApi({
    now: () => clock,
    // Tokens look like "token:<name>"; anything else is refused, like a token for another app.
    // "token:<name>@<client>" is issued to another client; it's accepted only if that client is configured.
    async verifyToken(token, clientIds) {
      const [name = "", client = "client.apps.googleusercontent.com"] = token.startsWith("token:") ? token.slice(6).split("@") : [];
      if (!name) throw new HttpError(401, "Google didn't accept this sign-in. Sign in again.");
      if (!clientIds.includes(client)) throw new HttpError(401, "This sign-in was issued to a different app.");
      return { sub: `sub-${name}`, email: `${name}@example.com`, name: name[0].toUpperCase() + name.slice(1) };
    },
    async sendPush(_env, subscriptions, message, options) {
      pushes.push({ subscriptions, message, options });
      return subscriptions.filter((subscription) => subscription.endpoint.includes("gone")).map((subscription) => subscription.endpoint);
    },
    async sendNativePush(_env, tokens, message, options) {
      appPushes.push({ tokens, message, options });
      return tokens.filter((token) => token.includes("Gone"));
    },
  });

  const env = {
    DB: db,
    GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
    GOOGLE_CLIENT_IDS: "ios.apps.googleusercontent.com, android.apps.googleusercontent.com",
    APP_ORIGINS: "http://localhost:3000,http://localhost:8081",
    VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "https://linework.test",
  };

  /**
   * @param {string} method @param {string} path @param {unknown} [body]
   * @param {{ cookie?: string, headers?: Record<string, string | null> }} [options] a null header is left out
   */
  async function send(method, path, body, { cookie = "", headers = {} } = {}) {
    /** @type {Record<string, string | null>} */
    const all = {
      Origin: ORIGIN,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    };
    const response = await api(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: /** @type {Record<string, string>} */ (Object.fromEntries(Object.entries(all).filter(([, value]) => value !== null))),
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

  /**
   * Signs in the way the mobile app does: no Origin, no cookies, and a bearer token back.
   * @param {string} name @param {string} [client]
   */
  async function signInApp(name, client = "ios.apps.googleusercontent.com") {
    const response = await api(
      new Request(`${ORIGIN}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: `token:${name}@${client}`, tokenType: "bearer" }) }),
      /** @type {any} */ (env),
      { waitUntil: (promise) => void background.push(promise) },
    );
    const data = await response.json();
    if (response.status !== 200) throw new Error(`App sign-in failed: ${JSON.stringify(data)}`);
    const headers = { Authorization: `Bearer ${data.token}`, Origin: null };
    /** @param {string} method @param {string} path @param {unknown} [body] */
    const call = (method, path, body) => send(method, path, body, { headers });
    return {
      email: `${name}@example.com`,
      token: /** @type {string} */ (data.token),
      session: data,
      setCookie: response.headers.get("Set-Cookie"),
      /** @param {string} path */
      get: (path) => call("GET", path),
      /** @param {string} path @param {unknown} [body] */
      post: (path, body = {}) => call("POST", path, body),
      /** @param {string} path */
      delete: (path) => call("DELETE", path),
    };
  }

  /** Sends a request and returns the raw response, for ones without a JSON body. @param {Request} request */
  const raw = (request) => api(request, /** @type {any} */ (env), { waitUntil: (promise) => void background.push(promise) });

  return {
    db,
    env,
    raw,
    send,
    signIn,
    signInApp,
    pushes,
    appPushes,
    /** Waits for work the API continued after responding, such as push delivery. */
    settle: () => Promise.all(background.splice(0)),
    /** @param {number} ms */
    advance: (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
}
