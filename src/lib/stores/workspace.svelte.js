import { SvelteSet } from "svelte/reactivity";
import { errorMessage, pluralize } from "../format.js";
import { SheetsPermissionError, isRetryable } from "../google/sheets-client.js";
import { sheets as api } from "../google/sheets.js";
import { columnLetter, fieldToCell, parseSpreadsheetId, textToCell } from "../sheets/values.js";
import { STORAGE_KEYS, readJson, readString, writeJson, writeString } from "../storage.js";
import { account } from "./account.svelte.js";
import { auth } from "./auth.svelte.js";
import { changeLog } from "./changes.svelte.js";
import { toast } from "./toast.svelte.js";

/**
 * @typedef {{ id: string, title: string, url: string }} SheetLink
 * @typedef {Record<string, string>} ColumnMapping column index → scan field key
 * @typedef {import("../google/sheets-client.js").SheetProperties} SheetProperties
 * @typedef {import("../google/sheets-client.js").SpreadsheetMetadata} SpreadsheetMetadata
 * @typedef {import("../barcode/fields.js").ScanField} ScanField
 * @typedef {import("./changes.svelte.js").ChangeKind} ChangeKind
 */

const VIEW_ONLY_MESSAGE = "This Google account can view this spreadsheet but can't edit it. Ask for Editor access to make changes.";

/** @param {unknown} value */
const isLinkList = (value) => Array.isArray(value) && value.every((link) => typeof link?.id === "string" && typeof link?.title === "string");
/** @param {unknown} value */
const isMappingTable = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const spreadsheetUrl = (/** @type {string} */ id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

const STORED_MESSAGE = "Google Sheets couldn't be reached, so Linework stored this change. Use Migrate changes once Google is back.";

/**
 * The linked spreadsheets, the open tab, its rows, and how scan fields map onto its columns.
 * Loads are sequenced so a slow response can never overwrite a newer selection.
 */
class WorkspaceStore {
  /** @type {SheetLink[]} */
  links = $state(readJson(STORAGE_KEYS.links, [], isLinkList));
  /** @type {Record<string, ColumnMapping>} keyed by `${spreadsheetId}:${sheetId}` */
  mappings = $state(readJson(STORAGE_KEYS.mappings, {}, isMappingTable));
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
  #loadSequence = 0;
  #saveQueue = Promise.resolve();

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
      this.rows = rows;
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
      this.rows = rows;
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
    this.rows = rows;
    this.setStatus(this.#rowsStatus(rows.length));
  }

  /** @param {number} column @param {string} fieldKey empty to clear */
  setMapping(column, fieldKey) {
    if (!this.mapKey) return;
    const next = { ...this.mapping };
    if (fieldKey) next[column] = fieldKey;
    else delete next[column];
    this.mappings[this.mapKey] = next;
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
    this.#persistMappings();
    await this.open(id, tab.sheetId);
    toast.show(`Column ${columnLetter(index)} deleted`);
  }

  /**
   * Adds a row, or updates an existing one by writing only the cells that changed so
   * untouched formulas and formatting are preserved.
   * @param {number | null} rowNumber 1-based sheet row, or null to append
   * @param {string[]} values
   */
  async saveRow(rowNumber, values) {
    const { id, tab } = this.#requireTab({ storable: true });
    const headers = [...this.headers];
    /** @type {"applied" | "stored"} */
    let outcome;
    if (rowNumber) {
      const current = this.rows[rowNumber - 1] ?? [];
      const cells = values.flatMap((value, column) => (value === (current[column] ?? "") ? [] : [{ row: rowNumber, column, value: textToCell(value) }]));
      if (!cells.length) return;
      outcome = await this.#rowChange(
        id,
        tab,
        "update",
        { row: rowNumber, before: [...current], cells: cells.map(({ column, value }) => ({ column, header: headers[column] ?? "", before: current[column] ?? "", after: value })) },
        () => api.updateCells(id, tab.title, cells),
      );
    } else {
      if (!values.some((value) => value.trim())) throw new Error("Enter at least one value.");
      const row = values.map(textToCell);
      outcome = await this.#rowChange(
        id,
        tab,
        "append",
        { cells: row.flatMap((value, column) => (value === "" ? [] : [{ column, header: headers[column] ?? "", value }])) },
        () => api.appendRow(id, tab.title, row),
      );
    }
    if (outcome === "stored") {
      toast.show(STORED_MESSAGE);
      return;
    }
    await this.#reloadRows(id, tab.sheetId);
    toast.show(rowNumber ? `Row ${rowNumber} updated` : "Row added");
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
    const outcome = await this.#rowChange(id, tab, "delete-row", { row: rowNumber, before }, () => api.deleteRow(id, tab.sheetId, rowNumber));
    if (outcome === "stored") {
      toast.show(STORED_MESSAGE);
      return;
    }
    await this.#reloadRows(id, tab.sheetId);
    toast.show(`Row ${rowNumber} deleted`);
  }

  /**
   * Appends one row holding every mapped field found in a scan. Saves run one at a time so
   * rapid scans land in the order they were read.
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
    const payload = { cells: values.flatMap((value, column) => (value === "" ? [] : [{ column, header: headers[column] ?? "", value }])), source: "scan" };

    this.pendingSaves++;
    this.#saveQueue = this.#saveQueue.then(async () => {
      try {
        const outcome = await this.#rowChange(id, tab, "append", payload, () => api.appendRow(id, tab.title, values));
        if (outcome === "stored") {
          this.lastSave = { ok: true, at: new Date(), message: "Stored in Linework until Google Sheets is reachable" };
          toast.show("Google Sheets couldn't be reached, so the scan was stored in Linework. Migrate changes once Google is back.");
          return;
        }
        this.lastSave = { ok: true, at: new Date(), message: `Saved to “${tab.title}”` };
        toast.show("Scan saved to Google Sheets");
      } catch (error) {
        const message = errorMessage(error);
        this.lastSave = { ok: false, at: new Date(), message };
        this.setStatus(message, true);
        toast.error(`Scan not saved: ${message}`);
        return;
      } finally {
        this.pendingSaves--;
      }
      await this.#reloadRows(id, tab.sheetId).catch((error) => console.warn("Could not refresh rows after saving a scan.", error));
    });
  }
}

export const workspace = new WorkspaceStore();
