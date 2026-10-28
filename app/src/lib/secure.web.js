/**
 * Web build (development): browsers have no secure enclave, so the session token lasts only as
 * long as this tab (sessionStorage).
 */
const KEY = "linework-session";

export async function readSessionToken() {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} token empty to forget it */
export async function writeSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* The token stays in memory for this session. */
  }
}
