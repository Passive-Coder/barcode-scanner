import { ApiError, ApiUnavailableError, api } from "../api/client.js";
import { addToOutbox, readOutbox, removeFromOutbox } from "../changes/outbox.js";
import { sheets } from "../google/sheets.js";
import { migrateChanges } from "../sheets/migrate.js";
import { STORAGE_KEYS, readJson, writeJson } from "../storage.js";
import { account } from "./account.svelte.js";
import { auth } from "./auth.svelte.js";

/**
 * The change log for the signed-in person: every change they make to a spreadsheet through
 * Linework is recorded in Linework's database, per spreadsheet. When Google Sheets can't be
 * reached, row changes are stored as "pending" and migrated into the spreadsheet later with
 * Migrate changes. If Linework's server can't be reached either, changes wait in this browser
 * and are uploaded when it can.
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
 * @typedef {{ claimId: string, results: import("../sheets/migrate.js").ChangeResult[] }} UnsentReport
 */

const UPLOAD_CHUNK = 200;

/** @param {unknown} value */
const isReportList = (value) => Array.isArray(value) && value.every((report) => typeof report?.claimId === "string" && Array.isArray(report?.results));

class ChangeLogStore {
  /** Pending and conflicting counts per spreadsheet, as the server last reported them. */
  summary = $state.raw(/** @type {Record<string, { pending: number, conflicts: number }>} */ ({}));
  /** Changes waiting in this browser for the server, for the signed-in person. */
  local = $state.raw(/** @type {LoggedChange[]} */ ([]));
  /** Pending and conflicting changes of the spreadsheet last loaded with `load`. */
  open = $state.raw(/** @type {LoggedChange[]} */ ([]));
  history = $state.raw(/** @type {LoggedChange[]} */ ([]));
  loadedFor = $state("");
  migrating = $state(false);
  /** Whether the change log dialog is open. */
  reviewOpen = $state(false);

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

  #readLocal() {
    this.local = auth.email ? readOutbox(auth.email).map((entry) => /** @type {LoggedChange} */ ({ message: "", ...entry.change })) : [];
  }

  /** @param {string} spreadsheetId @param {"pending" | "conflicts"} field @param {number} delta */
  #adjust(spreadsheetId, field, delta) {
    const current = this.summary[spreadsheetId] ?? { pending: 0, conflicts: 0 };
    this.summary = { ...this.summary, [spreadsheetId]: { ...current, [field]: Math.max(0, current[field] + delta) } };
  }

  /**
   * Records a change. Applied changes are history, so failing to record one is only logged.
   * A pending change must not be lost: if the server can't take it, it waits in this browser,
   * and if that fails too, this throws.
   * @param {ChangeDraft} draft
   * @param {"applied" | "pending"} status
   */
  async record(draft, status) {
    const change = { ...draft, status };
    if (account.ready) {
      try {
        await api.post("/changes", { changes: [change] });
        if (status === "pending") this.#adjust(change.spreadsheetId, "pending", 1);
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
      addToOutbox(auth.email, change);
      this.#readLocal();
    } catch (error) {
      if (status === "pending") throw error;
      console.warn("Could not keep a change for the change log.", error);
    }
  }

  /** Uploads changes waiting in this browser. Returns false if the server can't be reached. */
  async upload() {
    this.#readLocal();
    if (!this.local.length) return true;
    if (!(await account.ensure())) return false;
    for (let start = 0; start < this.local.length; start += UPLOAD_CHUNK) {
      const chunk = this.local.slice(start, start + UPLOAD_CHUNK);
      try {
        const { stored } = await api.post("/changes", { changes: chunk.map(({ message: _message, ...change }) => change) });
        removeFromOutbox(stored);
      } catch (error) {
        console.warn("Could not upload stored changes.", error);
        this.#readLocal();
        return false;
      }
    }
    this.#readLocal();
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
    } catch (error) {
      console.warn("Could not load the change summary.", error);
    }
  }

  /** Runs after each sign-in: sends anything left over from earlier, then refreshes counts. */
  async sync() {
    this.#readLocal();
    await this.#sendUnsentResults();
    await this.upload();
    await this.refreshSummary();
  }

  /** @param {string} spreadsheetId */
  async load(spreadsheetId) {
    this.#readLocal();
    if (!(await account.ensure())) {
      this.loadedFor = spreadsheetId;
      this.open = [];
      this.history = [];
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
  }

  /**
   * Results the server didn't confirm are kept here and sent before anything is claimed
   * again, so a change is never applied twice.
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
    const unsent = readJson(STORAGE_KEYS.unsentResults, /** @type {UnsentReport[]} */ ([]), isReportList);
    writeJson(STORAGE_KEYS.unsentResults, [...unsent, report]);
    throw new ApiUnavailableError("Linework's server stopped responding during the migration. Your progress is saved in this browser.");
  }

  async #sendUnsentResults() {
    const unsent = readJson(STORAGE_KEYS.unsentResults, /** @type {UnsentReport[]} */ ([]), isReportList);
    if (!unsent.length || !account.ready) return;
    const left = [];
    for (const report of unsent) {
      try {
        await api.post("/changes/report", report);
      } catch (error) {
        if (!(error instanceof ApiError)) left.push(report);
      }
    }
    writeJson(STORAGE_KEYS.unsentResults, left);
  }

  /**
   * Writes the spreadsheet's pending changes into Google Sheets, oldest first.
   * @param {string} spreadsheetId
   * @returns {Promise<{ applied: number, conflicts: number }>}
   */
  async migrate(spreadsheetId) {
    if (this.migrating) throw new Error("Changes are already being migrated.");
    if (!auth.connected) throw new Error(auth.status === "expired" ? "Reconnect Google first, then migrate your changes." : "Connect Google first.");
    this.migrating = true;
    let applied = 0;
    let conflicts = 0;
    try {
      if (!(await account.ensure())) throw new ApiUnavailableError("Linework's server can't be reached, so stored changes can't be migrated yet.");
      await this.#sendUnsentResults();
      if (!(await this.upload())) throw new ApiUnavailableError("Changes stored in this browser couldn't be uploaded to Linework yet. Try again in a moment.");
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
      await this.load(spreadsheetId).catch((error) => console.warn("Could not reload changes after migrating.", error));
    }
  }

  /** @param {string} spreadsheetId @param {string[]} ids */
  async discard(spreadsheetId, ids) {
    const waiting = new Set(this.local.map((change) => change.id));
    const local = ids.filter((id) => waiting.has(id));
    if (local.length) {
      removeFromOutbox(local);
      this.#readLocal();
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
    this.summary = {};
    this.local = [];
    this.open = [];
    this.history = [];
    this.loadedFor = "";
  }
}

export const changeLog = new ChangeLogStore();
