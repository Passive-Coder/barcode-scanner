import { STORAGE_KEYS, readJson } from "../storage.js";

/**
 * Changes waiting in this browser because neither Google Sheets nor Linework's server could
 * be reached. They are uploaded to the server as soon as it can be reached again. Entries are
 * tagged with the Google account that made them, so a shared browser keeps people apart.
 *
 * @typedef {{ owner: string, change: Record<string, any> & { id: string, spreadsheetId: string, status: "applied" | "pending" } }} OutboxEntry
 */

const MAX_ENTRIES = 2000;

/** @param {unknown} value */
const isEntryList = (value) => Array.isArray(value) && value.every((entry) => typeof entry?.owner === "string" && typeof entry?.change?.id === "string");

/** @returns {OutboxEntry[]} */
const readAll = () => readJson(STORAGE_KEYS.outbox, [], isEntryList);

/** @param {OutboxEntry[]} entries */
function writeAll(entries) {
  // Unlike other settings, a change that can't be saved must not be silently dropped.
  if (entries.length) localStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify(entries));
  else localStorage.removeItem(STORAGE_KEYS.outbox);
}

/** @param {string} owner */
export const readOutbox = (owner) => readAll().filter((entry) => entry.owner === owner.toLowerCase());

/**
 * @param {string} owner @param {OutboxEntry["change"]} change
 * @throws if the browser can't store it
 */
export function addToOutbox(owner, change) {
  const entries = readAll();
  if (entries.length >= MAX_ENTRIES) throw new Error("Too many changes are waiting in this browser. Reconnect to Linework to upload them first.");
  entries.push({ owner: owner.toLowerCase(), change });
  try {
    writeAll(entries);
  } catch {
    throw new Error("This browser couldn't store the change.");
  }
}

/** @param {Iterable<string>} ids */
export function removeFromOutbox(ids) {
  const done = new Set(ids);
  try {
    writeAll(readAll().filter((entry) => !done.has(entry.change.id)));
  } catch {
    /* Re-sending later is harmless: the server stores each change once. */
  }
}
