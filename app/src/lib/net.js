/**
 * `fetch` with a time limit. React Native has AbortController but not AbortSignal.timeout().
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} ms
 */
export async function fetchWithTimeout(url, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Whether a fetch failed because it ran out of time. @param {unknown} error */
export const isTimeout = (error) => /** @type {any} */ (error)?.name === "AbortError";
