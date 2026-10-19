import { GoogleAuth } from "./google/auth.js";
import { SheetsClient, columnLetter, parseSpreadsheetId } from "./google/sheets.js";

const $ = (selector) => document.querySelector(selector);
const LINKS_KEY = "linework-sheet-links";
const MAPPINGS_KEY = "linework-sheet-mappings";
const ACTIVE_KEY = "linework-active-sheet";
const AUTOSAVE_KEY = "linework-auto-save";

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function node(tag, className = "", content) {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function option(value, label) {
  const item = node("option", "", label);
  item.value = String(value);
  return item;
}

function sheetValue(field) {
  if (field.type === "Number" && Number.isFinite(Number(field.value)) && field.value !== "") return Number(field.value);
  if (field.type === "Boolean") return field.value === "true";
  return field.value;
}

export class SheetsWorkspace {
  constructor({ onToast, onError, onMappingChange }) {
    this.auth = new GoogleAuth();
    this.api = new SheetsClient(this.auth);
    this.onToast = onToast;
    this.onError = onError;
    this.onMappingChange = onMappingChange;
    this.links = readStored(LINKS_KEY, []);
    this.mappings = readStored(MAPPINGS_KEY, {});
    this.activeId = localStorage.getItem(ACTIVE_KEY) || "";
    this.metadata = null;
    this.sheet = null;
    this.rows = [];
    this.lastFields = [];
    this.saving = Promise.resolve();
    this.autoSave = localStorage.getItem(AUTOSAVE_KEY) !== "false";
    this.bind();
    this.render();
  }

  get mapKey() { return this.sheet && this.activeId ? `${this.activeId}:${this.sheet.properties.sheetId}` : ""; }
  get mapping() { return this.mappings[this.mapKey] || {}; }
  get columns() {
    const mapped = Object.keys(this.mapping).map(Number);
    return Math.max(0, ...this.rows.map((row) => row.length), mapped.length ? Math.max(...mapped) + 1 : 0);
  }

  updateClientId(value) {
    this.auth.setClientId(value);
    this.metadata = null;
    this.sheet = null;
    this.rows = [];
    this.render();
  }

  disconnect() {
    this.auth.disconnect();
    this.metadata = null;
    this.sheet = null;
    this.rows = [];
    this.render();
  }

  async connect() {
    await this.auth.connect();
    this.onToast("Google connected");
    this.render();
    if (this.activeId) await this.loadDocument(this.activeId);
  }

  async addLink() {
    const id = parseSpreadsheetId($("#sheet-link-input").value);
    if (!this.auth.connected) throw new Error("Connect Google first, then open the spreadsheet.");
    await this.loadDocument(id);
    const title = this.metadata.properties?.title || id;
    const index = this.links.findIndex((link) => link.id === id);
    const entry = { id, title, url: this.metadata.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit` };
    if (index < 0) this.links.unshift(entry);
    else this.links[index] = entry;
    localStorage.setItem(LINKS_KEY, JSON.stringify(this.links));
    $("#sheet-link-input").value = "";
    this.render();
    this.onToast("Spreadsheet linked");
  }

  async loadDocument(id, preferredSheetId) {
    if (!this.auth.connected) {
      this.render();
      throw new Error("Connect Google to read this spreadsheet.");
    }
    this.setStatus("Reading spreadsheet…");
    const metadata = await this.api.getSpreadsheet(id);
    const sheets = metadata.sheets || [];
    this.activeId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    this.metadata = metadata;
    const linked = this.links.find((link) => link.id === id);
    if (linked && linked.title !== metadata.properties?.title) {
      linked.title = metadata.properties?.title || id;
      localStorage.setItem(LINKS_KEY, JSON.stringify(this.links));
    }
    this.sheet = sheets.find((item) => String(item.properties.sheetId) === String(preferredSheetId ?? this.sheet?.properties.sheetId)) || sheets[0] || null;
    await this.loadValues();
    this.render();
  }

  async loadValues() {
    this.rows = this.sheet ? await this.api.getSheetValues(this.activeId, this.sheet.properties.title) : [];
    this.setStatus(this.sheet ? `Reading “${this.sheet.properties.title}” · ${Math.max(0, this.rows.length - 1)} data rows loaded` : "This spreadsheet has no tabs.");
  }

  setStatus(message, isError = false) {
    const target = $("#sheet-status");
    target.textContent = message;
    target.classList.toggle("error", isError);
  }

  async run(action, context) {
    try { await action(); }
    catch (error) {
      this.setStatus(error.message || String(error), true);
      this.onError(error, context);
    }
  }

  bind() {
    $("#google-button").addEventListener("click", () => this.run(() => this.connect(), "Google sign-in failed"));
    $("#add-link-button").addEventListener("click", () => this.run(() => this.addLink(), "Could not open spreadsheet"));
    $("#sheet-link-input").addEventListener("keydown", (event) => { if (event.key === "Enter") this.run(() => this.addLink(), "Could not open spreadsheet"); });
    $("#document-select").addEventListener("change", (event) => {
      if (event.target.value) this.run(() => this.loadDocument(event.target.value), "Could not read spreadsheet");
    });
    $("#tab-select").addEventListener("change", (event) => {
      const sheet = this.metadata?.sheets?.find((item) => String(item.properties.sheetId) === event.target.value);
      if (!sheet) return;
      this.sheet = sheet;
      this.run(async () => { await this.loadValues(); this.render(); }, "Could not read tab");
    });
    $("#refresh-sheet").addEventListener("click", () => this.run(() => this.loadDocument(this.activeId), "Could not refresh spreadsheet"));
    $("#forget-link").addEventListener("click", () => {
      if (!this.activeId) return;
      this.links = this.links.filter((link) => link.id !== this.activeId);
      localStorage.setItem(LINKS_KEY, JSON.stringify(this.links));
      this.activeId = "";
      localStorage.removeItem(ACTIVE_KEY);
      this.metadata = null; this.sheet = null; this.rows = [];
      this.render();
      this.onToast("Link removed from this browser");
    });
    $("#auto-save").addEventListener("change", (event) => {
      this.autoSave = event.target.checked;
      localStorage.setItem(AUTOSAVE_KEY, String(this.autoSave));
      this.onToast(this.autoSave ? "Automatic recording on" : "Automatic recording paused");
    });
    $("#add-tab").addEventListener("click", () => this.editText("Add a sheet tab", "Tab name", "", async (title) => {
      await this.api.addSheet(this.activeId, title);
      await this.loadDocument(this.activeId);
      this.onToast("Tab added");
    }));
    $("#rename-tab").addEventListener("click", () => this.editText("Rename sheet tab", "Tab name", this.sheet?.properties.title || "", async (title) => {
      await this.api.renameSheet(this.activeId, this.sheet.properties.sheetId, title);
      await this.loadDocument(this.activeId, this.sheet.properties.sheetId);
      this.onToast("Tab renamed");
    }));
    $("#delete-tab").addEventListener("click", () => this.run(async () => {
      if (!this.sheet || !confirm(`Delete the entire “${this.sheet.properties.title}” tab and its data?`)) return;
      if ((this.metadata.sheets || []).length <= 1) throw new Error("A spreadsheet must contain at least one tab.");
      await this.api.deleteSheet(this.activeId, this.sheet.properties.sheetId);
      delete this.mappings[this.mapKey];
      localStorage.setItem(MAPPINGS_KEY, JSON.stringify(this.mappings));
      this.sheet = null;
      await this.loadDocument(this.activeId);
      this.onToast("Tab deleted");
    }, "Could not delete tab"));
    $("#add-column").addEventListener("click", () => this.editText("Add a column", "Column heading", "", async (value) => {
      const index = this.columns;
      if (index >= this.sheet.properties.gridProperties.columnCount) {
        await this.api.appendColumn(this.activeId, this.sheet.properties.sheetId);
      }
      await this.api.updateCell(this.activeId, this.sheet.properties.title, 1, index, value);
      await this.loadDocument(this.activeId, this.sheet.properties.sheetId);
      this.onToast("Column added");
    }));
    $("#column-mappings").addEventListener("change", (event) => {
      if (!event.target.matches("select[data-column]")) return;
      const column = event.target.dataset.column;
      const map = { ...this.mapping };
      if (event.target.value) map[column] = event.target.value;
      else delete map[column];
      this.mappings[this.mapKey] = map;
      localStorage.setItem(MAPPINGS_KEY, JSON.stringify(this.mappings));
      this.renderMappings();
      this.onMappingChange();
    });
    $("#column-mappings").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const index = Number(button.dataset.column);
      if (button.dataset.action === "rename") this.editText("Rename column", "Column heading", this.rows[0]?.[index] || "", async (value) => {
        await this.api.updateCell(this.activeId, this.sheet.properties.title, 1, index, value);
        await this.loadValues(); this.render(); this.onToast("Column renamed");
      });
      if (button.dataset.action === "delete") this.run(async () => {
        if (!confirm(`Delete column ${columnLetter(index)} and all its values?`)) return;
        await this.api.deleteColumn(this.activeId, this.sheet.properties.sheetId, index);
        const next = {};
        for (const [key, value] of Object.entries(this.mapping)) {
          if (Number(key) < index) next[key] = value;
          else if (Number(key) > index) next[Number(key) - 1] = value;
        }
        this.mappings[this.mapKey] = next;
        localStorage.setItem(MAPPINGS_KEY, JSON.stringify(this.mappings));
        await this.loadValues(); this.render(); this.onToast("Column deleted");
      }, "Could not delete column");
    });
    $("#add-row").addEventListener("click", () => this.editRow(null));
    $("#sheet-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const row = Number(button.dataset.row);
      if (button.dataset.action === "edit") this.editRow(row);
      if (button.dataset.action === "delete") this.run(async () => {
        if (!confirm(`Delete row ${row} and all its values?`)) return;
        await this.api.deleteRow(this.activeId, this.sheet.properties.sheetId, row);
        await this.loadValues(); this.render(); this.onToast("Row deleted");
      }, "Could not delete row");
    });
  }

  editText(title, label, initial, save) {
    this.showEditor(title, "", [{ label, value: initial }], async (values) => {
      const value = values[0].trim();
      if (!value) throw new Error(`${label} cannot be empty.`);
      await save(value);
    });
  }

  editRow(rowNumber) {
    if (!this.sheet) return;
    if (!this.columns) {
      this.onError(new Error("Add a column heading first."), "Cannot edit row");
      return;
    }
    const current = rowNumber ? this.rows[rowNumber - 1] || [] : [];
    const fields = Array.from({ length: this.columns }, (_, index) => ({
      label: this.rows[0]?.[index] || `Column ${columnLetter(index)}`,
      value: current[index] || "",
    }));
    this.showEditor(rowNumber ? `Edit row ${rowNumber}` : "Add a row", "Values are written directly to the selected Google Sheet.", fields, async (values) => {
      if (rowNumber) {
        await this.api.updateRow(this.activeId, this.sheet.properties.title, rowNumber, values);
      } else {
        await this.api.appendRow(this.activeId, this.sheet.properties.title, values);
      }
      await this.loadValues(); this.render();
      this.onToast(rowNumber ? "Row updated" : "Row added");
    });
  }

  showEditor(title, description, fields, save) {
    const dialog = $("#edit-dialog");
    $("#edit-title").textContent = title;
    $("#edit-description").textContent = description;
    const container = $("#edit-fields");
    container.replaceChildren(...fields.map((field) => {
      const label = node("label", "edit-field");
      label.append(node("span", "", field.label));
      const input = node("input");
      input.type = "text"; input.value = field.value;
      label.append(input);
      return label;
    }));
    const form = $("#edit-form");
    form.onsubmit = (event) => {
      event.preventDefault();
      const values = [...container.querySelectorAll("input")].map((input) => input.value);
      this.run(async () => { await save(values); dialog.close(); }, "Could not save change");
    };
    $("#edit-close").onclick = () => dialog.close();
    $("#edit-cancel").onclick = () => dialog.close();
    dialog.showModal();
    container.querySelector("input")?.focus();
  }

  setFields(fields) {
    this.lastFields = fields;
    this.renderMappings();
    this.onMappingChange();
  }

  selectedFields(fields) {
    const selected = new Set(Object.values(this.mapping));
    return fields.filter((field) => selected.has(field.key));
  }

  recordScan(fields) {
    if (!this.autoSave || !this.auth.connected || !this.sheet || !Object.keys(this.mapping).length) return;
    const id = this.activeId, title = this.sheet.properties.title;
    const mapping = { ...this.mapping };
    const count = this.columns;
    const byKey = new Map(fields.map((field) => [field.key, sheetValue(field)]));
    const values = Array.from({ length: count }, (_, index) => byKey.get(mapping[index]) ?? "");
    if (!values.some((value) => value !== "")) {
      this.onToast("No mapped field found in this barcode; nothing was saved");
      return;
    }
    this.saving = this.saving.then(async () => {
      this.setStatus("Saving scan to Google Sheets…");
      await this.api.appendRow(id, title, values);
      if (this.activeId === id && this.sheet?.properties.title === title) {
        await this.loadValues(); this.renderTable();
      }
      this.onToast("Scan saved to Google Sheets");
    }).catch((error) => {
      this.setStatus(error.message || String(error), true);
      this.onError(error, "Could not save scan");
    });
  }

  render() {
    $("#account-label").textContent = this.auth.connected ? (this.auth.email || "GOOGLE CONNECTED") : "GOOGLE NOT CONNECTED";
    $("#google-button").textContent = this.auth.connected ? "Reconnect Google ↗" : "Connect Google ↗";
    $("#document-select").replaceChildren(option("", "Choose a spreadsheet"), ...this.links.map((link) => option(link.id, link.title)));
    $("#document-select").value = this.activeId;
    $("#tab-select").replaceChildren(option("", "Choose a tab"), ...(this.metadata?.sheets || []).map((sheet) => option(sheet.properties.sheetId, sheet.properties.title)));
    $("#tab-select").value = this.sheet ? String(this.sheet.properties.sheetId) : "";
    $("#sheet-content").hidden = !this.sheet;
    $("#sheet-title").textContent = this.metadata?.properties?.title || "Spreadsheet";
    $("#auto-save").checked = this.autoSave;
    $("#sheet-count").textContent = this.sheet ? ` · ${this.sheet.properties.title}` : "";
    $("#refresh-sheet").disabled = !this.activeId || !this.auth.connected;
    $("#forget-link").disabled = !this.activeId;
    if (!this.sheet) this.setStatus(this.auth.connected ? "Paste a Google Sheets link to begin." : "Connect Google to read your spreadsheet and manage its data.");
    this.renderMappings();
    this.renderTable();
  }

  renderMappings() {
    if (!this.sheet) return;
    const count = this.columns;
    const container = $("#column-mappings");
    if (!count) {
      container.replaceChildren(node("p", "empty-note", "No columns yet. Add a column heading to set up this tab."));
      return;
    }
    container.replaceChildren(...Array.from({ length: count }, (_, index) => {
      const row = node("div", "mapping-row");
      const heading = node("div", "mapping-column");
      heading.append(node("span", "column-letter", columnLetter(index)), node("strong", "", this.rows[0]?.[index] || "Untitled column"));
      const select = node("select", "mapping-select");
      select.dataset.column = String(index);
      select.setAttribute("aria-label", `Field for column ${columnLetter(index)}`);
      select.append(option("", "Do not fill from scans"));
      const choices = [...this.lastFields];
      const stored = this.mapping[index];
      if (stored && !choices.some((field) => field.key === stored)) choices.push({ key: stored, label: stored, type: "Other" });
      for (const field of choices) select.append(option(field.key, `${field.label} · ${field.type}`));
      select.value = stored || "";
      const actions = node("div", "mapping-actions");
      const rename = node("button", "icon-text", "Rename"); rename.type = "button"; rename.dataset.action = "rename"; rename.dataset.column = String(index);
      const remove = node("button", "icon-text danger", "Delete"); remove.type = "button"; remove.dataset.action = "delete"; remove.dataset.column = String(index);
      actions.append(rename, remove);
      row.append(heading, select, actions);
      return row;
    }));
    const n = Object.keys(this.mapping).length;
    $("#mapping-count").textContent = `${n} of ${count} columns mapped${this.lastFields.length ? ` · ${this.lastFields.length} fields available from latest scan` : " · scan to reveal fields"}`;
  }

  renderTable() {
    if (!this.sheet) return;
    const container = $("#sheet-table");
    const count = this.columns;
    if (!count) { container.replaceChildren(node("p", "empty-note", "Column headings and rows will appear here.")); return; }
    const table = node("table", "data-table");
    const head = node("thead"), headRow = node("tr");
    headRow.append(node("th", "row-number", "#"));
    for (let index = 0; index < count; index++) headRow.append(node("th", "", this.rows[0]?.[index] || columnLetter(index)));
    headRow.append(node("th", "row-actions", "ACTIONS")); head.append(headRow);
    const body = node("tbody");
    for (let index = 1; index < this.rows.length; index++) {
      const row = node("tr");
      row.append(node("td", "row-number", String(index + 1)));
      for (let col = 0; col < count; col++) row.append(node("td", "", this.rows[index]?.[col] || "—"));
      const actions = node("td", "row-actions");
      for (const [name, label] of [["edit", "Edit"], ["delete", "Delete"]]) {
        const button = node("button", `table-button ${name === "delete" ? "danger" : ""}`, label);
        button.type = "button"; button.dataset.action = name; button.dataset.row = String(index + 1);
        actions.append(button);
      }
      row.append(actions); body.append(row);
    }
    table.append(head, body);
    container.replaceChildren(table);
    if (!body.children.length) container.append(node("p", "empty-note", "No data rows yet. Scan a barcode or add a row."));
  }
}
