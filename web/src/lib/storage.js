/**
 * Keys are unchanged from the original app so existing links, mappings, and settings survive
 * the upgrade. Every access is guarded: storage can be disabled, full, or hold corrupt JSON.
 */
export const STORAGE_KEYS = Object.freeze({
  links: "linework-sheet-links",
  mappings: "linework-sheet-mappings",
  /** The column headings each mapping was made for, so it can follow columns that move. */
  mappingHeaders: "linework-sheet-mapping-headers",
  activeSpreadsheet: "linework-active-sheet",
  autoSave: "linework-auto-save",
  clientId: "linework-dedicated-google-client-id",
  /** Spreadsheet changes waiting to reach Linework's server, per Google account. */
  outbox: "linework-change-outbox",
  /** Migration results the server hasn't confirmed yet. */
  unsentResults: "linework-unsent-migration-results",
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
