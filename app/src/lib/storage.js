import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Settings kept on this device (spreadsheet links, column mappings, preferences). Every access
 * is guarded: storage can fail or hold corrupt JSON. Session tokens live in secure storage instead.
 */
export const STORAGE_KEYS = Object.freeze({
  links: "linework-sheet-links",
  mappings: "linework-sheet-mappings",
  /** The column headings each mapping was made for, so it can follow columns that move. */
  mappingHeaders: "linework-sheet-mapping-headers",
  activeSpreadsheet: "linework-active-sheet",
  autoSave: "linework-auto-save",
  /** Spreadsheet changes waiting to reach Linework's server, per Google account. */
  outbox: "linework-change-outbox",
  /** Migration results the server hasn't confirmed yet. */
  unsentResults: "linework-unsent-migration-results",
});

/** @param {string} key */
export async function readString(key) {
  try {
    return (await AsyncStorage.getItem(key)) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} key @param {string} value */
export async function writeString(key, value) {
  try {
    if (value) await AsyncStorage.setItem(key, value);
    else await AsyncStorage.removeItem(key);
  } catch {
    /* Storage is unavailable; the value stays in memory for this session. */
  }
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {(value: unknown) => boolean} isValid
 * @returns {Promise<T>}
 */
export async function readJson(key, fallback, isValid) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {unknown} value */
export async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage is unavailable; the value stays in memory for this session. */
  }
}

/**
 * Like writeJson, but a failure is reported: used where losing the value would lose data.
 * @param {string} key @param {unknown} value
 */
export async function writeJsonStrict(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
