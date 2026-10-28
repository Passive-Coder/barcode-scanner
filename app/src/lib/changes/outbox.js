import { STORAGE_KEYS, readJson, writeJsonStrict } from "../storage.js";

/**
 * Changes waiting on this device because neither Google Sheets nor Linework's server could be
 * reached. They're uploaded to the server as soon as it can be reached again. Entries are tagged
 * with the Google account that made them, so a shared device keeps people apart.
 * (Mirrors web/src/lib/changes/outbox.js, with asynchronous storage.)
 *
 * @typedef {{ owner: string, change: Record<string, any> & { id: string, spreadsheetId: string, status: "applied" | "pending" } }} OutboxEntry
 */

const MAX_ENTRIES = 2000;

/** @param {unknown} value */
const isEntryList = (value) => Array.isArray(value) && value.every((entry) => typeof entry?.owner === "string" && typeof entry?.change?.id === "string");

/** @returns {Promise<OutboxEntry[]>} */
const readAll = () => readJson(STORAGE_KEYS.outbox, /** @type {OutboxEntry[]} */ ([]), isEntryList);

/** Writes queue one after another so concurrent changes can't overwrite each other. */
let queue = Promise.resolve();
/** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
function serialize(task) {
  const next = queue.then(task, task);
  queue = next.then(
    () => {},
    () => {},
  );
  return next;
}

/** @param {string} owner */
export async function readOutbox(owner) {
  return (await readAll()).filter((entry) => entry.owner === owner.toLowerCase());
}

/**
 * @param {string} owner @param {OutboxEntry["change"]} change
 * @throws if the device can't store it
 */
export function addToOutbox(owner, change) {
  return serialize(async () => {
    const entries = await readAll();
    if (entries.length >= MAX_ENTRIES) throw new Error("Too many changes are waiting on this device. Reconnect to Linework to upload them first.");
    entries.push({ owner: owner.toLowerCase(), change });
    try {
      await writeJsonStrict(STORAGE_KEYS.outbox, entries);
    } catch {
      throw new Error("This device couldn't store the change.");
    }
  });
}

/** @param {Iterable<string>} ids */
export function removeFromOutbox(ids) {
  const done = new Set(ids);
  return serialize(async () => {
    try {
      await writeJsonStrict(STORAGE_KEYS.outbox, (await readAll()).filter((entry) => !done.has(entry.change.id)));
    } catch {
      /* Re-sending later is harmless: the server stores each change once. */
    }
  });
}
