import { config } from "../config.js";
import { fetchWithTimeout } from "../net.js";

/**
 * Client for Linework's API (the Cloudflare Worker). The app authenticates with a bearer token
 * from its session, kept in secure storage, rather than a cookie.
 * (Mirrors web/src/lib/api/client.js.)
 */
const REQUEST_TIMEOUT_MS = 20_000;

/** The API answered with an error meant for the person. */
export class ApiError extends Error {
  name = "ApiError";

  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Linework's server couldn't be reached, or failed. */
export class ApiUnavailableError extends Error {
  name = "ApiUnavailableError";
}

/** @type {() => string} */
let sessionToken = () => "";
/** @type {() => void} */
let onSessionLost = () => {};

/**
 * Connects the client to the account store without importing it (which would be circular).
 * @param {{ token: () => string, onLost: () => void }} session
 */
export function connectSession({ token, onLost }) {
  sessionToken = token;
  onSessionLost = onLost;
}

/**
 * @param {string} method
 * @param {string} path below /api
 * @param {unknown} [body]
 * @param {string} [bearer] a token to use instead of the session's (when opening one)
 */
async function request(method, path, body, bearer) {
  const token = bearer ?? sessionToken();
  let response;
  try {
    response = await fetchWithTimeout(
      `${config.apiUrl}/api${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch {
    throw new ApiUnavailableError("Linework's server can't be reached. Check your connection and try again.");
  }
  /** @type {any} */
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* Handled below by status. */
  }
  if (response.ok) return data;
  const message = typeof data?.error === "string" ? data.error : "";
  if (response.status === 401 && path !== "/session") onSessionLost();
  if (response.status >= 500 || !data) throw new ApiUnavailableError(message || "Linework's server had a problem. Try again in a moment.");
  throw new ApiError(message || `Request failed (${response.status}).`, response.status);
}

export const api = {
  /** @param {string} path @param {string} [bearer] */
  get: (path, bearer) => request("GET", path, undefined, bearer),
  /** @param {string} path @param {unknown} [body] */
  post: (path, body = {}) => request("POST", path, body),
  /** @param {string} path @param {unknown} [body] */
  patch: (path, body = {}) => request("PATCH", path, body),
  /** @param {string} path */
  delete: (path) => request("DELETE", path),
};
