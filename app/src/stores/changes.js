import { ApiError, ApiUnavailableError, api } from "../lib/api/client.js";
import { createAutoSync } from "../lib/changes/auto-sync.js";
import { addToOutbox, readOutbox, removeFromOutbox } from "../lib/changes/outbox.js";
import { errorMessage } from "../lib/format.js";
import { sheets } from "../lib/google/clients.js";
import { isRetryable } from "../lib/google/sheets-client.js";
import { migrateChanges } from "../lib/sheets/migrate.js";
import { STORAGE_KEYS, readJson, writeJson } from "../lib/storage.js";
import { Store } from "../lib/store.js";
import { account } from "./account.js";
import { auth } from "./auth.js";

/**
 * The change log for the signed-in person: every change they make to a spreadsheet through
 * Linework is recorded in Linework's database, per spreadsheet. When Google Sheets can't be
 * reached, row changes are stored as "pending" and migrated into the spreadsheet automatically
 * as soon as Google responds again (Migrate changes does it on demand). If Linework's server
 * can't be reached either, changes wait on the device and are uploaded when it can.
 * (Mirrors web/src/lib/stores/changes.svelte.js.)
 *
 * @typedef {"append" | "update" | "delete-row" | "add-tab" | "rename-tab" | "delete-tab" | "add-column" | "rename-column" | "delete-column"} ChangeKind
 * @typedef {{
 *   id: string,
 *   spreadsheetId: string,
 *   spreadsheetTitle: string,
 *   sheetId: number,
 *   sheetTitle: string,
 *   kind: ChangeKind,
 *   payload: Record<string, any>,
 *   createdAt: number,
 * }} ChangeDraft
 * @typedef {ChangeDraft & { status: "applied" | "pending" | "migrating" | "conflict" | "discarded", message: string, updatedAt?: number }} LoggedChange
 * @typedef {{ claimId: string, results: import("../lib/sheets/migrate.js").ChangeResult[] }} UnsentReport
 * @typedef {(spreadsheetId: string, outcome: { applied: number, conflicts: number }, automatic: boolean) => void} MigratedListener
 */

const UPLOAD_CHUNK = 200;

/** @param {unknown} value */
const isReportList = (value) => Array.isArray(value) && value.every((report) => typeof report?.claimId === "string" && Array.isArray(report?.results));

class ChangeLogStore extends Store {
  /** Pending and conflicting counts per spreadsheet, as the server last reported them. @type {Record<string, { pending: number, conflicts: number }>} */
  summary = {};
  /** Changes waiting on this device for the server, for the signed-in person. @type {LoggedChange[]} */
  local = [];
  /** Pending and conflicting changes of the spreadsheet last loaded with `load`. @type {LoggedChange[]} */
  open = [];
  /** @type {LoggedChange[]} */
  history = [];
  loadedFor = "";
  migrating = false;
  /** Spreadsheets whose stored changes need the person (for example no edit access), with the reason. @type {Record<string, string>} */
  blocked = {};
  /** @type {MigratedListener[]} */
  #migratedListeners = [];
  #auto = createAutoSync({ run: () => this.#autoMigrate() });

  /** Whether changes can be kept when Google can't take them: the person is known. */
  get canStore() {
    return Boolean(auth.email);
  }

  /** @param {string} spreadsheetId */
  counts(spreadsheetId) {
    const server = this.summary[spreadsheetId] ?? { pending: 0, conflicts: 0 };
    const waiting = this.local.filter((change) => change.spreadsheetId === spreadsheetId && change.status === "pending").length;
    return { pending: server.pending + waiting, conflicts: server.conflicts, local: waiting };
  }

  /** @param {MigratedListener} listener runs after changes were written into a spreadsheet */
  onMigrated(listener) {
    this.#migratedListeners.push(listener);
  }

  /** Starts migrating stored changes in the background (after sign-in). */
  startAuto() {
    this.#auto.start();
  }

  stopAuto() {
    this.#auto.stop();
  }

  /** Something that may let stored changes through just happened: try soon. @param {number} [delay] */
  nudge(delay = 0) {
    this.#auto.nudge(delay);
  }

  /** Lets automatic migration try every spreadsheet again, for example after reconnecting. */
  unblock() {
    this.blocked = {};
    this.changed();
    this.nudge();
  }

  async #readLocal() {
    this.local = auth.email ? (await readOutbox(auth.email)).map((entry) => /** @type {LoggedChange} */ ({ message: "", ...entry.change })) : [];
    this.changed();
  }

  /** @param {string} spreadsheetId @param {"pending" | "conflicts"} field @param {number} delta */
  #adjust(spreadsheetId, field, delta) {
    const current = this.summary[spreadsheetId] ?? { pending: 0, conflicts: 0 };
    this.summary = { ...this.summary, [spreadsheetId]: { ...current, [field]: Math.max(0, current[field] + delta) } };
    this.changed();
  }

  /**
   * Records a change. Applied changes are history, so failing to record one is only logged.
   * A pending change must not be lost: if the server can't take it, it waits on the device, and
   * if that fails too, this throws.
   * @param {ChangeDraft} draft
   * @param {"applied" | "pending"} status
   */
  async record(draft, status) {
    const change = { ...draft, status };
    if (account.ready) {
      try {
        await api.post("/changes", { changes: [change] });
        if (status === "pending") {
          this.#adjust(change.spreadsheetId, "pending", 1);
          this.nudge(2000);
        }
        return;
      } catch (error) {
        // The server refused the change itself (for example too many waiting): say so.
        if (status === "pending" && error instanceof ApiError && error.status !== 401) throw error;
        if (status === "applied" && !(error instanceof ApiUnavailableError)) {
          console.warn("Could not record a change in the change log.", error);
          return;
        }
      }
    }
    try {
      await addToOutbox(auth.email, change);
      await this.#readLocal();
      if (status === "pending") this.nudge(2000);
    } catch (error) {
      if (status === "pending") throw error;
      console.warn("Could not keep a change for the change log.", error);
    }
  }

  /** Uploads changes waiting on this device. Returns false if the server can't be reached. */
  async upload() {
    await this.#readLocal();
    if (!this.local.length) return true;
    if (!(await account.ensure())) return false;
    for (let start = 0; start < this.local.length; start += UPLOAD_CHUNK) {
      const chunk = this.local.slice(start, start + UPLOAD_CHUNK);
      try {
        const { stored } = await api.post("/changes", { changes: chunk.map(({ message: _message, ...change }) => change) });
        await removeFromOutbox(stored);
      } catch (error) {
        console.warn("Could not upload stored changes.", error);
        await this.#readLocal();
        return false;
      }
    }
    await this.#readLocal();
    return true;
  }

  async refreshSummary() {
    if (!account.ready) return;
    try {
      const { spreadsheets } = await api.get("/changes/summary");
      /** @type {Record<string, { pending: number, conflicts: number }>} */
      const summary = {};
      for (const item of spreadsheets) summary[item.spreadsheetId] = { pending: item.pending, conflicts: item.conflicts };
      this.summary = summary;
      this.changed();
    } catch (error) {
      console.warn("Could not load the change summary.", error);
    }
  }

  /** Runs after each sign-in: sends anything left over from earlier, then refreshes counts. */
  async sync() {
    await this.#readLocal();
    await this.#sendUnsentResults();
    await this.upload();
    await this.refreshSummary();
  }

  /** @param {string} spreadsheetId */
  async load(spreadsheetId) {
    await this.#readLocal();
    if (!(await account.ensure())) {
      this.loadedFor = spreadsheetId;
      this.open = [];
      this.history = [];
      this.changed();
      return;
    }
    const encoded = encodeURIComponent(spreadsheetId);
    const [open, history] = await Promise.all([api.get(`/changes?spreadsheetId=${encoded}&view=open`), api.get(`/changes?spreadsheetId=${encoded}&view=history`)]);
    this.open = open.changes;
    this.history = history.changes;
    this.loadedFor = spreadsheetId;
    const pending = this.open.filter((change) => change.status !== "conflict").length;
    const conflicts = this.open.length - pending;
    this.summary = { ...this.summary, [spreadsheetId]: { pending, conflicts } };
    this.changed();
  }

  /**
   * Results the server didn't confirm are kept on the device and sent before anything is
   * claimed again, so a change is never applied twice.
   * @param {UnsentReport} report
   */
  async #report(report) {
    for (const delay of [0, 1000, 3000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        await api.post("/changes/report", report);
        return;
      } catch (error) {
        if (error instanceof ApiError) throw error;
      }
    }
    const unsent = await readJson(STORAGE_KEYS.unsentResults, /** @type {UnsentReport[]} */ ([]), isReportList);
    await writeJson(STORAGE_KEYS.unsentResults, [...unsent, report]);
    throw new ApiUnavailableError("Linework's server stopped responding during the migration. Your progress is saved on this device.");
  }

  async #sendUnsentResults() {
    const unsent = await readJson(STORAGE_KEYS.unsentResults, /** @type {UnsentReport[]} */ ([]), isReportList);
    if (!unsent.length || !account.ready) return;
    const left = [];
    for (const report of unsent) {
      try {
        await api.post("/changes/report", report);
      } catch (error) {
        if (!(error instanceof ApiError)) left.push(report);
      }
    }
    await writeJson(STORAGE_KEYS.unsentResults, left);
  }

  /**
   * Background run: uploads anything waiting on the device, then migrates every spreadsheet
   * that has stored changes. Reports "retry" while Google or the server is still unreachable.
   * @returns {Promise<"done" | "retry">}
   */
  async #autoMigrate() {
    // Without Google there's nothing to do until the person reconnects, which nudges again.
    if (!auth.connected || !account.ready) return "done";
    if (this.migrating) return "retry";
    await this.#sendUnsentResults();
    if (!(await this.upload())) return "retry";
    await this.refreshSummary();
    const targets = Object.entries(this.summary)
      .filter(([id, counts]) => counts.pending > 0 && !this.blocked[id])
      .map(([id]) => id);
    let retry = false;
    for (const id of targets) {
      try {
        await this.#migrate(id, true);
      } catch (error) {
        const transient = isRetryable(error) || error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 409);
        if (transient) retry = true;
        else {
          this.blocked = { ...this.blocked, [id]: errorMessage(error) };
          this.changed();
        }
      }
    }
    return retry ? "retry" : "done";
  }

  /**
   * Writes the spreadsheet's pending changes into Google Sheets, oldest first.
   * @param {string} spreadsheetId
   * @returns {Promise<{ applied: number, conflicts: number }>}
   */
  migrate(spreadsheetId) {
    if (this.blocked[spreadsheetId]) {
      const { [spreadsheetId]: _cleared, ...rest } = this.blocked;
      this.blocked = rest;
      this.changed();
    }
    return this.#migrate(spreadsheetId, false);
  }

  /** @param {string} spreadsheetId @param {boolean} automatic */
  async #migrate(spreadsheetId, automatic) {
    if (this.migrating) throw new Error("Changes are already being migrated.");
    if (!auth.connected) throw new Error(auth.status === "expired" ? "Reconnect Google first, then migrate your changes." : "Connect Google first.");
    this.migrating = true;
    this.changed();
    let applied = 0;
    let conflicts = 0;
    try {
      if (!(await account.ensure())) throw new ApiUnavailableError("Linework's server can't be reached, so stored changes can't be migrated yet.");
      await this.#sendUnsentResults();
      if (!(await this.upload())) throw new ApiUnavailableError("Changes stored on this device couldn't be uploaded to Linework yet. Try again in a moment.");
      for (;;) {
        const { claimId, changes } = await api.post("/changes/claim", { spreadsheetId });
        if (!changes.length) break;
        const outcome = await migrateChanges({
          spreadsheetId,
          changes,
          sheets,
          report: (results) => this.#report({ claimId, results }),
        });
        applied += outcome.applied;
        conflicts += outcome.conflicts;
        if (outcome.error) throw outcome.error;
        if (changes.length < 500) break;
      }
      return { applied, conflicts };
    } finally {
      this.migrating = false;
      this.changed();
      await this.load(spreadsheetId).catch((error) => console.warn("Could not reload changes after migrating.", error));
      if (applied || conflicts) {
        for (const listener of this.#migratedListeners) {
          try {
            listener(spreadsheetId, { applied, conflicts }, automatic);
          } catch (error) {
            console.warn("A migration listener failed.", error);
          }
        }
      }
    }
  }

  /** @param {string} spreadsheetId @param {string[]} ids */
  async discard(spreadsheetId, ids) {
    const waiting = new Set(this.local.map((change) => change.id));
    const local = ids.filter((id) => waiting.has(id));
    if (local.length) {
      await removeFromOutbox(local);
      await this.#readLocal();
    }
    const remote = ids.filter((id) => !waiting.has(id));
    if (remote.length) await api.post("/changes/discard", { ids: remote });
    await this.load(spreadsheetId);
  }

  /** @param {string} spreadsheetId @param {string[]} ids */
  async retry(spreadsheetId, ids) {
    await api.post("/changes/retry", { ids });
    await this.load(spreadsheetId);
  }

  reset() {
    this.stopAuto();
    this.blocked = {};
    this.summary = {};
    this.local = [];
    this.open = [];
    this.history = [];
    this.loadedFor = "";
    this.changed();
  }
}

export const changeLog = new ChangeLogStore();
