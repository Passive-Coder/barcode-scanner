/**
 * Client for Linework's own API (the Cloudflare Worker under /api). The session lives in an
 * HttpOnly cookie, so no credentials are handled here.
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

/** @type {() => void} */
let onSessionLost = () => {};

/** @param {() => void} handler called when the server says the session has ended */
export function handleSessionLoss(handler) {
  onSessionLost = handler;
}

/**
 * @param {string} method
 * @param {string} path below /api
 * @param {unknown} [body]
 */
async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
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
  /** @param {string} path */
  get: (path) => request("GET", path),
  /** @param {string} path @param {unknown} [body] */
  post: (path, body = {}) => request("POST", path, body),
  /** @param {string} path @param {unknown} [body] */
  patch: (path, body = {}) => request("PATCH", path, body),
  /** @param {string} path */
  delete: (path) => request("DELETE", path),
};
