/**
 * Keys are unchanged from the original app so existing links, mappings, and settings survive
 * the upgrade. Every access is guarded: storage can be disabled, full, or hold corrupt JSON.
 */
export const STORAGE_KEYS = Object.freeze({
  links: "linework-sheet-links",
  mappings: "linework-sheet-mappings",
  activeSpreadsheet: "linework-active-sheet",
  autoSave: "linework-auto-save",
  clientId: "linework-dedicated-google-client-id",
});

/** @param {string} key */
export function readString(key) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} key @param {string} value */
export function writeString(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* Storage is unavailable; the value stays in memory for this session. */
  }
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {(value: unknown) => boolean} isValid
 * @returns {T}
 */
export function readJson(key, fallback, isValid) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {unknown} value */
export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage is unavailable; the value stays in memory for this session. */
  }
}
