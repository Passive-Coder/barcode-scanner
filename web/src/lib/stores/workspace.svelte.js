import { SvelteSet } from "svelte/reactivity";
import { errorMessage, pluralize } from "../format.js";
import { GoogleUnavailableError, SheetsPermissionError, isRetryable } from "../google/sheets-client.js";
import { sheets as api } from "../google/sheets.js";
import { SheetConflictError, appendPlaced, deletePlaced, updatePlaced } from "../sheets/live-write.js";
import { remapColumns } from "../sheets/mapping.js";
import { columnLetter, fieldToCell, parseSpreadsheetId, textToCell } from "../sheets/values.js";
import { STORAGE_KEYS, readJson, readString, writeJson, writeString } from "../storage.js";
import { account } from "./account.svelte.js";
import { auth } from "./auth.svelte.js";
import { changeLog } from "./changes.svelte.js";
import { dialogs } from "./dialogs.svelte.js";
import { toast } from "./toast.svelte.js";

/**
 * @typedef {{ id: string, title: string, url: string }} SheetLink
 * @typedef {Record<string, string>} ColumnMapping column index → scan field key
 * @typedef {import("../google/sheets-client.js").SheetProperties} SheetProperties
 * @typedef {import("../google/sheets-client.js").SpreadsheetMetadata} SpreadsheetMetadata
 * @typedef {import("../barcode/fields.js").ScanField} ScanField
 * @typedef {import("./changes.svelte.js").ChangeKind} ChangeKind
 * @typedef {import("../sheets/migrate.js").AppendCell} AppendCell
 */

const VIEW_ONLY_MESSAGE = "This Google account can view this spreadsheet but can't edit it. Ask for Editor access to make changes.";

/** @param {unknown} value */
const isLinkList = (value) => Array.isArray(value) && value.every((link) => typeof link?.id === "string" && typeof link?.title === "string");
/** @param {unknown} value */
const isMappingTable = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const spreadsheetUrl = (/** @type {string} */ id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

const STORED_MESSAGE = "Google Sheets couldn't be reached, so Linework stored this change. It's added automatically as soon as Google responds.";

/** How often the open tab is re-read from Google while it's on screen, so edits made elsewhere show up. */
const LIVE_INTERVAL_MS = 5000;
/** Less often while the window isn't focused. */
const LIVE_IDLE_INTERVAL_MS = 15_000;
/** After Google asks Linework to slow down (or doesn't respond), for a couple of minutes. */
const LIVE_SLOW_INTERVAL_MS = 30_000;
const LIVE_SLOW_FOR_MS = 2 * 60_000;
/** Tab names and the spreadsheet's title are re-read every this many live updates. */
const LIVE_METADATA_EVERY = 6;

/**
 * Longer sheets are re-read less often: each read returns every row, so this keeps live updates
 * within Google's request limits and light on mobile data. @param {number} rowCount
 */
const sizeFactor = (rowCount) => (rowCount > 2500 ? 4 : rowCount > 1000 ? 2 : 1);

/** @param {string[][]} a @param {string[][]} b */
const sameRows = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The linked spreadsheets, the open tab, its rows, and how scan fields map onto its columns.
 * Loads are sequenced so a slow response can never overwrite a newer selection.
 */
class WorkspaceStore {
  /** @type {SheetLink[]} */
  links = $state(readJson(STORAGE_KEYS.links, [], isLinkList));
  /** @type {Record<string, ColumnMapping>} keyed by `${spreadsheetId}:${sheetId}` */
  mappings = $state(readJson(STORAGE_KEYS.mappings, {}, isMappingTable));
  /** @type {Record<string, string[]>} the headings each mapping was made for, by the same key */
  #mappingHeaders = readJson(STORAGE_KEYS.mappingHeaders, {}, isMappingTable);
  activeId = $state(readString(STORAGE_KEYS.activeSpreadsheet));
  /** @type {SpreadsheetMetadata | null} */
  metadata = $state.raw(null);
  /** @type {number | null} */
  sheetId = $state(null);
  /** @type {string[][]} */
  rows = $state.raw([]);
  autoSave = $state(readString(STORAGE_KEYS.autoSave) !== "false");
  loading = $state(false);
  pendingSaves = $state(0);
  /** @type {{ message: string, error: boolean }} */
  status = $state.raw({ message: "", error: false });
  /** @type {{ ok: boolean, at: Date, message: string } | null} */
  lastSave = $state.raw(null);
  /** Spreadsheets Google has refused to let this account edit, this session. */
  viewOnlyIds = new SvelteSet();
  /** When the open tab last matched Google Sheets, from live updates (0 before the first). */
  syncedAt = $state(0);
  #loadSequence = 0;
  #saveQueue = Promise.resolve();
  /** Scans waiting to be written; scans made in quick succession go to Google together. @type {Array<{ id: string, tab: SheetProperties, payload: { cells: AppendCell[], source: "scan" } }>} */
  #scans = [];
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #liveTimer;
  #livePauses = 0;
  #livePolls = 0;
  #liveSlowUntil = 0;

  /** @type {SheetProperties[]} */
  tabs = $derived(this.metadata?.sheets?.map((sheet) => sheet.properties) ?? []);
  tab = $derived(this.tabs.find((tab) => tab.sheetId === this.sheetId) ?? null);
  title = $derived(this.metadata?.properties?.title ?? "");
  mapKey = $derived(this.tab && this.activeId ? `${this.activeId}:${this.tab.sheetId}` : "");
  /** @type {ColumnMapping} */
  mapping = $derived(this.mappings[this.mapKey] ?? {});
  mappedCount = $derived(Object.keys(this.mapping).length);
  headers = $derived(this.rows[0] ?? []);
  columnCount = $derived.by(() => {
    const mapped = Object.keys(this.mapping).map(Number);
    return Math.max(0, ...this.rows.map((row) => row.length), mapped.length ? Math.max(...mapped) + 1 : 0);
  });
  /** Field keys mapped to any column of the open tab. */
  mappedKeys = $derived(new Set(Object.values(this.mapping)));

  /** The open spreadsheet is shared with this account as view-only. */
  readOnly = $derived(Boolean(this.activeId) && this.viewOnlyIds.has(this.activeId));
  /** Whether edit controls should be enabled. */
  canEdit = $derived(auth.connected && !this.loading && !this.readOnly);

  /** Whether new scans will be written, and if not, what the person needs to do. */
  recording = $derived.by(() => {
    const storing = auth.status === "expired" && changeLog.canStore;
    if (auth.status === "expired" && !storing) return { active: false, reason: "Google session expired. Reconnect to keep recording scans." };
    if (!auth.connected && !storing) return { active: false, reason: "Connect Google to record scans in a spreadsheet." };
    if (this.readOnly) return { active: false, reason: "This account can view the spreadsheet but can't edit it. Ask for Editor access to save scans." };
    if (!this.tab) return { active: false, reason: "Choose a spreadsheet tab to record scans." };
    if (!this.mappedCount) return { active: false, reason: "Map at least one column to a barcode field to record scans." };
    if (!this.autoSave) return { active: false, reason: "Automatic recording is paused." };
    if (storing) return { active: true, reason: "Google session expired. Scans are stored in Linework until you reconnect and migrate them." };
    return { active: true, reason: `Recording ${pluralize(this.mappedCount, "mapped column")} to “${this.tab.title}”.` };
  });

  statusText = $derived.by(() => {
    if (this.status.error || this.loading) return this.status.message;
    if (!auth.connected && !this.tab) return "Connect Google to read your spreadsheet and manage its data.";
    if (!this.activeId) return "Paste a Google Sheets link to begin.";
    return this.status.message;
  });

  /** @param {string} message @param {boolean} [error] */
  setStatus(message, error = false) {
    this.status = { message, error };
  }

  #persistLinks() {
    writeJson(STORAGE_KEYS.links, $state.snapshot(this.links));
  }

  #persistMappings() {
    writeJson(STORAGE_KEYS.mappings, $state.snapshot(this.mappings));
    writeJson(STORAGE_KEYS.mappingHeaders, this.#mappingHeaders);
  }

  /**
   * Replaces the open tab's rows. If its headings changed since its mapping was made (someone
   * inserted, moved, or deleted a column), the mapping moves with the columns.
   * @param {string[][]} rows
   */
  #setRows(rows) {
    this.rows = rows;
    const key = this.mapKey;
    const mapping = key ? this.mappings[key] : undefined;
    if (!mapping || !Object.keys(mapping).length) return;
    const headers = rows[0] ?? [];
    const known = this.#mappingHeaders[key];
    if (known && JSON.stringify(known) === JSON.stringify(headers)) return;
    if (known) {
      const next = remapColumns(mapping, known, headers);
      if (next !== mapping) this.mappings[key] = next;
    }
    this.#mappingHeaders[key] = [...headers];
    this.#persistMappings();
  }

  #requireConnection() {
    if (auth.connected) return;
    throw new Error(auth.status === "expired" ? "Your Google session expired. Reconnect Google to continue." : "Connect Google first, then open the spreadsheet.");
  }

  /** @param {{ storable?: boolean }} [options] storable: a row change, which can be stored if Google's session lapsed */
  #requireTab(options) {
    this.#requireEditable(options);
    if (!this.tab) throw new Error("Choose a spreadsheet tab first.");
    return { id: this.activeId, tab: this.tab };
  }

  /** @param {{ storable?: boolean }} [options] */
  #requireEditable({ storable = false } = {}) {
    if (!(storable && auth.status === "expired" && changeLog.canStore)) this.#requireConnection();
    if (this.readOnly) throw new SheetsPermissionError(VIEW_ONLY_MESSAGE, "view-only");
  }

  /**
   * @param {string} id @param {SheetProperties} tab @param {ChangeKind} kind @param {Record<string, any>} payload
   * @returns {import("./changes.svelte.js").ChangeDraft}
   */
  #draft(id, tab, kind, payload) {
    return { id: crypto.randomUUID(), spreadsheetId: id, spreadsheetTitle: id === this.activeId ? this.title : "", sheetId: tab.sheetId, sheetTitle: tab.title, kind, payload, createdAt: Date.now() };
  }

  /**
   * A structure change (tabs and columns) needs the live spreadsheet. It is logged once done.
   * @template T
   * @param {string} id @param {SheetProperties} tab @param {ChangeKind} kind @param {Record<string, any>} payload
   * @param {() => Promise<T>} task
   */
  async #structureChange(id, tab, kind, payload, task) {
    const result = await this.#write(id, task);
    void changeLog.record(this.#draft(id, tab, kind, payload), "applied");
    return result;
  }

  /**
   * A row change. If Google can't be reached, or Google's session lapsed, the change is
   * stored in Linework as pending instead of being lost, to be migrated later.
   * @param {string} id @param {SheetProperties} tab @param {ChangeKind} kind @param {Record<string, any>} payload
   * @param {() => Promise<unknown>} task
   * @returns {Promise<"applied" | "stored">}
   */
  async #rowChange(id, tab, kind, payload, task) {
    const draft = this.#draft(id, tab, kind, payload);
    try {
      await this.#write(id, task);
    } catch (error) {
      // Someone else's change got there first: show the sheet as it is now.
      if (error instanceof SheetConflictError) void this.#reloadRows(id, tab.sheetId).catch(() => {});
      if (!isRetryable(error) || !changeLog.canStore) throw error;
      try {
        await changeLog.record(draft, "pending");
      } catch (storeError) {
        throw new Error(`${errorMessage(error)} Linework couldn't store the change either: ${errorMessage(storeError)}`);
      }
      return "stored";
    }
    void changeLog.record(draft, "applied");
    return "applied";
  }

  /**
   * Runs a write. If Google says this account can only view the spreadsheet, it's marked
   * view-only so the UI can stop offering edits instead of failing again and again.
   * @template T
   * @param {string} id
   * @param {() => Promise<T>} task
   */
  async #write(id, task) {
    try {
      return await task();
    } catch (error) {
      if (error instanceof SheetsPermissionError && error.access === "view-only") this.viewOnlyIds.add(id);
      throw error;
    }
  }

  /** @param {number} rowCount */
  #rowsStatus(rowCount) {
    return this.tab ? `“${this.tab.title}” · ${pluralize(Math.max(0, rowCount - 1), "data row")} loaded` : "This spreadsheet has no tabs.";
  }

  /** Signs in with the user's Google account, then reopens the last spreadsheet. */
  async connect() {
    await auth.connect();
    // A different account may have different access to the same spreadsheets.
    this.viewOnlyIds.clear();
    void account.start();
    toast.show(auth.email ? `Signed in as ${auth.email}` : "Google connected");
    if (this.activeId) {
      await this.open(this.activeId).catch((error) => this.setStatus(errorMessage(error), true));
    }
  }

  signOut() {
    void account.end();
    auth.disconnect();
    this.viewOnlyIds.clear();
    this.metadata = null;
    this.sheetId = null;
    this.rows = [];
    this.setStatus("");
  }

  /** @param {string} input a Google Sheets link or spreadsheet ID */
  async addLink(input) {
    const id = parseSpreadsheetId(input);
    this.#requireConnection();
    await this.open(id);
    const entry = { id, title: this.title || id, url: this.metadata?.spreadsheetUrl ?? spreadsheetUrl(id) };
    const index = this.links.findIndex((link) => link.id === id);
    if (index < 0) this.links.unshift(entry);
    else this.links[index] = entry;
    this.#persistLinks();
    toast.show("Spreadsheet linked");
  }

  /** @param {string} id */
  removeLink(id) {
    this.links = this.links.filter((link) => link.id !== id);
    this.#persistLinks();
    if (this.activeId === id) {
      this.#loadSequence++;
      this.activeId = "";
      writeString(STORAGE_KEYS.activeSpreadsheet, "");
      this.metadata = null;
      this.sheetId = null;
      this.rows = [];
      this.loading = false;
      this.setStatus("");
    }
    toast.show("Link removed from this browser");
  }

  /**
   * Opens a spreadsheet and one of its tabs. Metadata and rows are applied together so the
   * UI never shows one spreadsheet's tabs with another's rows.
   * @param {string} id
   * @param {number | null} [preferredSheetId]
   */
  async open(id, preferredSheetId = null) {
    this.#requireConnection();
    const sequence = ++this.#loadSequence;
    this.loading = true;
    this.setStatus("Reading spreadsheet…");
    try {
      const metadata = await api.getSpreadsheet(id);
      if (sequence !== this.#loadSequence) return;
      const tabs = metadata.sheets?.map((sheet) => sheet.properties) ?? [];
      // Sheet IDs are only meaningful within one spreadsheet.
      const keep = preferredSheetId ?? (id === this.activeId ? this.sheetId : null);
      const tab = tabs.find((item) => item.sheetId === keep) ?? tabs[0] ?? null;
      const rows = tab ? await api.getValues(id, tab.title) : [];
      if (sequence !== this.#loadSequence) return;

      this.activeId = id;
      writeString(STORAGE_KEYS.activeSpreadsheet, id);
      this.metadata = metadata;
      this.sheetId = tab?.sheetId ?? null;
      this.#setRows(rows);
      this.syncedAt = Date.now();
      const linked = this.links.find((link) => link.id === id);
      if (linked && metadata.properties?.title && linked.title !== metadata.properties.title) {
        linked.title = metadata.properties.title;
        this.#persistLinks();
      }
      this.setStatus(this.#rowsStatus(rows.length));
    } catch (error) {
      if (sequence === this.#loadSequence) this.setStatus(errorMessage(error), true);
      throw error;
    } finally {
      if (sequence === this.#loadSequence) this.loading = false;
    }
  }

  /** @param {number} sheetId */
  async selectTab(sheetId) {
    this.#requireConnection();
    const tab = this.tabs.find((item) => item.sheetId === sheetId);
    if (!tab) return;
    const sequence = ++this.#loadSequence;
    const id = this.activeId;
    this.loading = true;
    this.setStatus(`Reading “${tab.title}”…`);
    try {
      const rows = await api.getValues(id, tab.title);
      if (sequence !== this.#loadSequence) return;
      this.sheetId = sheetId;
      this.#setRows(rows);
      this.syncedAt = Date.now();
      this.setStatus(this.#rowsStatus(rows.length));
    } catch (error) {
      if (sequence === this.#loadSequence) this.setStatus(errorMessage(error), true);
      throw error;
    } finally {
      if (sequence === this.#loadSequence) this.loading = false;
    }
  }

  /** Reloads the spreadsheet and forgets any earlier refusal, in case access has changed since. */
  refresh() {
    this.viewOnlyIds.delete(this.activeId);
    return this.open(this.activeId, this.sheetId);
  }

  /** Re-reads the open tab's rows, for example after stored changes were added in the background. */
  async reloadRows() {
    if (!auth.connected || !this.activeId || this.sheetId === null) return;
    await this.#reloadRows(this.activeId, this.sheetId);
  }

  /**
   * Keeps the open tab in step with Google Sheets: rows are re-read every few seconds while the
   * page is on screen, so changes made in Google Sheets or by other people appear on their own.
   */
  startLiveUpdates() {
    if (this.#liveTimer) return;
    /** @param {number} delay */
    const schedule = (delay) => {
      this.#liveTimer = setTimeout(async () => {
        await this.#pollLive();
        schedule(Date.now() < this.#liveSlowUntil ? LIVE_SLOW_INTERVAL_MS : (document.hasFocus() ? LIVE_INTERVAL_MS : LIVE_IDLE_INTERVAL_MS) * sizeFactor(this.rows.length));
      }, delay);
    };
    schedule(LIVE_INTERVAL_MS);
  }

  /**
   * Holds live updates while the person edits in place, so rows can't move under them.
   * @returns {() => void} call to release
   */
  pauseLive() {
    this.#livePauses++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#livePauses--;
    };
  }

  #liveHeld() {
    return this.#livePauses > 0 || this.pendingSaves > 0 || this.loading || Boolean(dialogs.form || dialogs.confirmation);
  }

  async #pollLive() {
    if (document.visibilityState !== "visible" || !auth.connected || !this.tab || this.#liveHeld()) return;
    const id = this.activeId;
    const sequence = this.#loadSequence;
    let tab = this.tab;
    try {
      if (++this.#livePolls % LIVE_METADATA_EVERY === 0) {
        const metadata = await api.getSpreadsheet(id);
        if (sequence !== this.#loadSequence || id !== this.activeId || this.#liveHeld()) return;
        const current = metadata.sheets?.map((sheet) => sheet.properties).find((item) => item.sheetId === tab.sheetId);
        // The tab was deleted elsewhere: show the spreadsheet's first tab instead.
        if (!current) {
          await this.open(id).catch(() => {});
          return;
        }
        if (JSON.stringify(metadata) !== JSON.stringify(this.metadata)) this.metadata = metadata;
        tab = current;
      }
      const rows = await api.getValues(id, tab.title);
      if (sequence !== this.#loadSequence || id !== this.activeId || tab.sheetId !== this.sheetId || this.#liveHeld()) return;
      if (!sameRows(rows, this.rows)) {
        this.#setRows(rows);
        if (!this.status.error) this.setStatus(this.#rowsStatus(rows.length));
      }
      this.syncedAt = Date.now();
    } catch (error) {
      // Other failures (a lapsed session, lost access) surface on the person's next action.
      if (error instanceof GoogleUnavailableError) this.#liveSlowUntil = Date.now() + LIVE_SLOW_FOR_MS;
    }
  }

  /**
   * Re-reads rows after a write without cancelling a newer navigation.
   * @param {string} id @param {number} sheetId
   */
  async #reloadRows(id, sheetId) {
    const sequence = this.#loadSequence;
    const tab = this.tabs.find((item) => item.sheetId === sheetId);
    if (!tab) return;
    const rows = await api.getValues(id, tab.title);
    if (sequence !== this.#loadSequence || id !== this.activeId || sheetId !== this.sheetId) return;
    this.#setRows(rows);
    this.syncedAt = Date.now();
    this.setStatus(this.#rowsStatus(rows.length));
  }

  /** @param {number} column @param {string} fieldKey empty to clear */
  setMapping(column, fieldKey) {
    if (!this.mapKey) return;
    const next = { ...this.mapping };
    if (fieldKey) next[column] = fieldKey;
    else delete next[column];
    this.mappings[this.mapKey] = next;
    this.#mappingHeaders[this.mapKey] = [...this.headers];
    this.#persistMappings();
  }

  /** @param {boolean} enabled */
  setAutoSave(enabled) {
    this.autoSave = enabled;
    writeString(STORAGE_KEYS.autoSave, String(enabled));
    toast.show(enabled ? "Automatic recording on" : "Automatic recording paused");
  }

  /** @param {string} title */
  async addTab(title) {
    this.#requireEditable();
    const id = this.activeId;
    const sheetId = await this.#write(id, () => api.addSheet(id, title));
    if (sheetId !== undefined) void changeLog.record(this.#draft(id, { sheetId, title }, "add-tab", { title }), "applied");
    await this.open(id, sheetId ?? this.sheetId);
    toast.show("Tab added");
  }

  /** @param {string} title */
  async renameTab(title) {
    const { id, tab } = this.#requireTab();
    await this.#structureChange(id, { ...tab, title }, "rename-tab", { from: tab.title, to: title }, () => api.renameSheet(id, tab.sheetId, title));
    await this.open(id, tab.sheetId);
    toast.show("Tab renamed");
  }

  async deleteTab() {
    const { id, tab } = this.#requireTab();
    if (this.tabs.length <= 1) throw new Error("A spreadsheet must keep at least one tab.");
    await this.#structureChange(id, tab, "delete-tab", { title: tab.title }, () => api.deleteSheet(id, tab.sheetId));
    delete this.mappings[`${id}:${tab.sheetId}`];
    delete this.#mappingHeaders[`${id}:${tab.sheetId}`];
    this.#persistMappings();
    await this.open(id, this.tabs.find((item) => item.sheetId !== tab.sheetId)?.sheetId ?? null);
    toast.show("Tab deleted");
  }

  /** @param {string} heading */
  async addColumn(heading) {
    const { id, tab } = this.#requireTab();
    const index = this.columnCount;
    await this.#structureChange(id, tab, "add-column", { column: index, header: heading }, async () => {
      if (index >= (tab.gridProperties?.columnCount ?? Infinity)) await api.appendColumn(id, tab.sheetId);
      await api.updateCells(id, tab.title, [{ row: 1, column: index, value: heading }]);
    });
    // The grid size changed, so reload metadata as well as rows.
    await this.open(id, tab.sheetId);
    toast.show("Column added");
  }

  /** @param {number} index @param {string} heading */
  async renameColumn(index, heading) {
    const { id, tab } = this.#requireTab();
    const from = this.headers[index] ?? "";
    await this.#structureChange(id, tab, "rename-column", { column: index, from, to: heading }, () => api.updateCells(id, tab.title, [{ row: 1, column: index, value: heading }]));
    await this.#reloadRows(id, tab.sheetId);
    toast.show("Column renamed");
  }

  /** @param {number} index */
  async deleteColumn(index) {
    const { id, tab } = this.#requireTab();
    await this.#structureChange(id, tab, "delete-column", { column: index, header: this.headers[index] ?? "" }, () => api.deleteColumn(id, tab.sheetId, index));
    // Columns to the right shift left, so their mappings move with them.
    /** @type {ColumnMapping} */
    const next = {};
    for (const [key, value] of Object.entries(this.mapping)) {
      const column = Number(key);
      if (column < index) next[column] = value;
      else if (column > index) next[column - 1] = value;
    }
    this.mappings[`${id}:${tab.sheetId}`] = next;
    this.#mappingHeaders[`${id}:${tab.sheetId}`] = this.headers.filter((_, column) => column !== index);
    this.#persistMappings();
    await this.open(id, tab.sheetId);
    toast.show(`Column ${columnLetter(index)} deleted`);
  }

  /**
   * Adds a row, or updates an existing one by writing only the cells that changed so
   * untouched formulas and formatting are preserved. Both are checked against Google Sheets
   * first, so a change someone else made meanwhile is never overwritten (see live-write.js).
   * @param {number | null} rowNumber 1-based sheet row, or null to append
   * @param {string[]} values
   */
  async saveRow(rowNumber, values) {
    const { id, tab } = this.#requireTab({ storable: true });
    const headers = [...this.headers];
    /** @type {"applied" | "stored"} */
    let outcome;
    let savedRow = rowNumber;
    if (rowNumber) {
      const current = this.rows[rowNumber - 1] ?? [];
      const cells = values.flatMap((value, column) => (value === (current[column] ?? "") ? [] : [{ column, header: headers[column] ?? "", before: current[column] ?? "", after: textToCell(value) }]));
      if (!cells.length) return;
      const change = { row: rowNumber, before: [...current], cells };
      const rowCount = this.rows.length;
      outcome = await this.#rowChange(id, tab, "update", change, async () => {
        savedRow = await updatePlaced({ sheets: api, spreadsheetId: id, tab, ...change, rowCount });
      });
    } else {
      if (!values.some((value) => value.trim())) throw new Error("Enter at least one value.");
      const payload = { cells: values.map(textToCell).flatMap((value, column) => (value === "" ? [] : [{ column, header: headers[column] ?? "", value }])) };
      outcome = await this.#rowChange(id, tab, "append", payload, async () => {
        const [problem] = await appendPlaced({ sheets: api, spreadsheetId: id, tab, rows: [payload.cells] });
        if (problem) throw new SheetConflictError(problem);
      });
    }
    if (outcome === "stored") {
      toast.show(STORED_MESSAGE);
      return;
    }
    await this.#reloadRows(id, tab.sheetId);
    toast.show(savedRow ? `Row ${savedRow} updated` : "Row added");
  }

  /**
   * Changes one cell, as when editing in the table.
   * @param {number} rowNumber 1-based sheet row @param {number} column @param {string} value
   */
  saveCell(rowNumber, column, value) {
    const values = Array.from({ length: Math.max(this.columnCount, column + 1) }, (_, index) => this.rows[rowNumber - 1]?.[index] ?? "");
    values[column] = value;
    return this.saveRow(rowNumber, values);
  }

  /** @param {number} rowNumber 1-based sheet row */
  async deleteRow(rowNumber) {
    const { id, tab } = this.#requireTab({ storable: true });
    const before = [...(this.rows[rowNumber - 1] ?? [])];
    let deleted = rowNumber;
    const outcome = await this.#rowChange(id, tab, "delete-row", { row: rowNumber, before }, async () => {
      deleted = await deletePlaced({ sheets: api, spreadsheetId: id, tab, row: rowNumber, before });
    });
    if (outcome === "stored") {
      toast.show(STORED_MESSAGE);
      return;
    }
    await this.#reloadRows(id, tab.sheetId);
    toast.show(`Row ${deleted} deleted`);
  }

  /**
   * Adds one row holding every mapped field found in a scan, below the last row in the tab and
   * under the columns' current headings, so it can't land on rows or columns other people are
   * changing. Writes run one at a time, and scans made in quick succession go out together.
   * @param {ScanField[]} fields
   */
  record(fields) {
    if (!this.recording.active || !this.tab) return;
    const id = this.activeId;
    const tab = this.tab;
    const mapping = { ...this.mapping };
    const headers = [...this.headers];
    const byKey = new Map(fields.map((field) => [field.key, fieldToCell(field)]));
    const values = Array.from({ length: this.columnCount }, (_, column) => byKey.get(mapping[column]) ?? "");
    if (!values.some((value) => value !== "")) {
      toast.show("This barcode has none of the mapped fields, so nothing was saved.");
      return;
    }
    const payload = { cells: values.flatMap((value, column) => (value === "" ? [] : [{ column, header: headers[column] ?? "", value }])), source: /** @type {const} */ ("scan") };
    this.#scans.push({ id, tab, payload });
    this.pendingSaves++;
    this.#saveQueue = this.#saveQueue.then(() => this.#writeScans());
  }

  /** Writes the waiting scans for one tab in a single request. */
  async #writeScans() {
    const first = this.#scans[0];
    if (!first) return;
    const { id, tab } = first;
    const batch = this.#scans.filter((scan) => scan.id === id && scan.tab.sheetId === tab.sheetId);
    this.#scans = this.#scans.filter((scan) => !batch.includes(scan));
    const count = batch.length;
    try {
      /** @type {string[]} */
      let problems;
      try {
        problems = await this.#write(id, () => appendPlaced({ sheets: api, spreadsheetId: id, tab, rows: batch.map((scan) => scan.payload.cells) }));
      } catch (error) {
        if (!isRetryable(error) || !changeLog.canStore) throw error;
        // Google can't be reached: keep the scans in Linework until it can.
        for (const scan of batch) await changeLog.record(this.#draft(id, tab, "append", scan.payload), "pending");
        this.lastSave = { ok: true, at: new Date(), message: "Stored in Linework until Google Sheets is reachable" };
        toast.show(`Google Sheets couldn't be reached, so ${count === 1 ? "the scan was" : `${count} scans were`} stored in Linework. ${count === 1 ? "It's" : "They're"} added automatically as soon as Google responds.`);
        return;
      }
      batch.forEach((scan, index) => {
        if (!problems[index]) void changeLog.record(this.#draft(id, tab, "append", scan.payload), "applied");
      });
      const problem = problems.find(Boolean);
      if (problem) {
        const message = `${problem} Check the column mapping in Sheet settings.`;
        this.lastSave = { ok: false, at: new Date(), message };
        toast.error(`Scan not saved: ${message}`);
      } else {
        this.lastSave = { ok: true, at: new Date(), message: `Saved to “${tab.title}”` };
        toast.show(count === 1 ? "Scan saved to Google Sheets" : `${count} scans saved to Google Sheets`);
      }
    } catch (error) {
      const message = errorMessage(error);
      this.lastSave = { ok: false, at: new Date(), message };
      this.setStatus(message, true);
      toast.error(`Scan not saved: ${message}`);
      return;
    } finally {
      this.pendingSaves -= count;
    }
    await this.#reloadRows(id, tab.sheetId).catch((error) => console.warn("Could not refresh rows after saving a scan.", error));
  }
}

export const workspace = new WorkspaceStore();
