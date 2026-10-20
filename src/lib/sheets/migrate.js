import { errorMessage } from "../format.js";
import { SheetsPermissionError, isRetryable } from "../google/sheets-client.js";

/**
 * Applies stored spreadsheet changes to Google Sheets without overwriting anyone's work:
 * - new rows are appended after the existing data, never written over it;
 * - values go to the column with the same heading, wherever that column is now;
 * - a cell edit is applied only if the cell still holds the value it had when it was edited;
 * - a row is found by its contents, so rows added or removed since don't misdirect a change.
 * Anything that can't be placed safely is reported as a conflict for the person to review.
 *
 * @typedef {import("./values.js").CellValue} CellValue
 * @typedef {{ column: number, header: string, value: CellValue }} AppendCell
 * @typedef {{ column: number, header: string, before: string, after: CellValue }} UpdateCell
 * @typedef {(
 *   | { kind: "append", payload: { cells: AppendCell[] } }
 *   | { kind: "update", payload: { row: number, before: string[], cells: UpdateCell[] } }
 *   | { kind: "delete-row", payload: { row: number, before: string[] } }
 * ) & { id: string, sheetId: number, sheetTitle: string }} StoredChange
 * @typedef {{ id: string, status: "applied" | "conflict" | "pending", message: string }} ChangeResult
 * @typedef {Pick<import("../google/sheets-client.js").SheetsClient, "getSpreadsheet" | "getValues" | "appendRows" | "updateCells" | "deleteRow">} SheetsApi
 */

/** @param {unknown} value */
const normalize = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Where a stored value belongs now: the column with the same heading (preferring its old
 * position), or for an unnamed column, the same position if it is still unnamed.
 * @param {string[]} headers
 * @param {{ column: number, header: string }} cell
 * @returns {number} -1 if the column is gone
 */
export function columnFor(headers, { column, header }) {
  const wanted = normalize(header);
  if (!wanted) return normalize(headers[column]) === "" ? column : -1;
  if (normalize(headers[column]) === wanted) return column;
  return headers.findIndex((heading) => normalize(heading) === wanted);
}

/** @param {unknown[]} row */
function rowKey(row) {
  const cells = row.map((value) => String(value ?? ""));
  while (cells.length && cells[cells.length - 1] === "") cells.pop();
  return JSON.stringify(cells);
}

/**
 * Finds the row whose values are `before`: at its old position if it's still there,
 * otherwise wherever it moved.
 * @param {string[][]} rows every row of the tab, headings first
 * @param {number} rowNumber 1-based position when the change was made
 * @param {string[]} before
 * @returns {number} the row's 1-based position, 0 if no row matches, -1 if several do
 */
export function findRow(rows, rowNumber, before) {
  const key = rowKey(before);
  if (rowNumber >= 2 && rows[rowNumber - 1] && rowKey(rows[rowNumber - 1]) === key) return rowNumber;
  const matches = rows.flatMap((row, index) => (index > 0 && rowKey(row) === key ? [index + 1] : []));
  if (matches.length === 1) return matches[0];
  return matches.length ? -1 : 0;
}

/**
 * Lays out a stored row under the tab's current headings.
 * @param {string[]} headers
 * @param {AppendCell[]} cells
 * @returns {{ values: CellValue[] } | { error: string }}
 */
export function placeRow(headers, cells) {
  /** @type {CellValue[]} */
  const values = [];
  for (const cell of cells) {
    const column = columnFor(headers, cell);
    if (column < 0) return { error: `The column “${cell.header}” is no longer in the tab.` };
    while (values.length < column) values.push("");
    values[column] = cell.value;
  }
  return { values };
}

/** @param {UpdateCell} cell @param {string} current */
const alreadyApplied = (cell, current) => current === String(cell.after ?? "");

/**
 * Applies changes in order. Consecutive new rows for the same tab are appended in one request.
 * If Google stops responding (or the session lapses), the remaining changes are handed back
 * as pending. Results are passed to `report` as they happen, so a closed tab loses little;
 * `report` must keep any results it can't deliver, or applied changes could be applied twice.
 * @param {{
 *   spreadsheetId: string,
 *   changes: StoredChange[],
 *   sheets: SheetsApi,
 *   report: (results: ChangeResult[]) => Promise<unknown>,
 * }} options
 * @returns {Promise<{ applied: number, conflicts: number, error: unknown }>} `error` is set if
 *   migration stopped early; the changes it didn't reach are back in the queue
 */
export async function migrateChanges({ spreadsheetId, changes, sheets, report }) {
  let applied = 0;
  let conflicts = 0;
  /** @type {ChangeResult[]} */
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const results = batch;
    batch = [];
    await report(results);
  };
  /** @param {{ id: string }} change @param {ChangeResult["status"]} status @param {string} [message] */
  const settle = (change, status, message = "") => {
    batch.push({ id: change.id, status, message });
    if (status === "applied") applied++;
    if (status === "conflict") conflicts++;
  };

  /**
   * Runs one write. A failure that would stop every write (Google unreachable, the session
   * lapsed, or no edit access) ends the migration; any other failure marks just these changes.
   * @param {Array<{ id: string }>} items @param {() => Promise<unknown>} write
   */
  const tryWrite = async (items, write) => {
    try {
      await write();
      return true;
    } catch (error) {
      if (isRetryable(error) || error instanceof SheetsPermissionError) throw error;
      for (const item of items) settle(item, "conflict", errorMessage(error));
      return false;
    }
  };

  let index = 0;
  try {
    const metadata = await sheets.getSpreadsheet(spreadsheetId);
    const tabs = new Map((metadata.sheets ?? []).map((sheet) => [sheet.properties.sheetId, sheet.properties]));
    /** @type {Map<number, string[][]>} rows as last read, dropped after every write */
    const cache = new Map();
    /** @param {import("../google/sheets-client.js").SheetProperties} tab */
    const read = async (tab) => {
      if (!cache.has(tab.sheetId)) cache.set(tab.sheetId, await sheets.getValues(spreadsheetId, tab.title));
      return /** @type {string[][]} */ (cache.get(tab.sheetId));
    };

    while (index < changes.length) {
      const change = changes[index];
      const tab = tabs.get(change.sheetId);
      if (!tab) {
        settle(change, "conflict", `The tab “${change.sheetTitle}” no longer exists.`);
        index++;
        continue;
      }

      if (change.kind === "append") {
        let end = index;
        while (end < changes.length && changes[end].kind === "append" && changes[end].sheetId === change.sheetId) end++;
        const run = /** @type {Array<StoredChange & { kind: "append" }>} */ (changes.slice(index, end));
        const headers = (await read(tab))[0] ?? [];
        /** @type {typeof run} */
        const ready = [];
        /** @type {CellValue[][]} */
        const rows = [];
        for (const item of run) {
          const placed = placeRow(headers, item.payload.cells);
          if ("error" in placed) settle(item, "conflict", placed.error);
          else {
            ready.push(item);
            rows.push(placed.values);
          }
        }
        if (rows.length && (await tryWrite(ready, () => sheets.appendRows(spreadsheetId, tab.title, rows)))) {
          for (const item of ready) settle(item, "applied");
        }
        cache.delete(tab.sheetId);
        index = end;
        await flush();
        continue;
      }

      const rows = await read(tab);
      const rowNumber = findRow(rows, change.payload.row, change.payload.before);
      if (change.kind === "update") {
        if (rowNumber <= 0) {
          settle(change, "conflict", rowNumber < 0 ? "More than one row now matches the row you edited." : "The row you edited was changed or removed in Google Sheets.");
        } else {
          const headers = rows[0] ?? [];
          const current = rows[rowNumber - 1] ?? [];
          /** @type {Array<{ row: number, column: number, value: CellValue }>} */
          const writes = [];
          let problem = "";
          for (const cell of change.payload.cells) {
            const column = columnFor(headers, cell);
            if (column < 0) {
              problem = `The column “${cell.header}” is no longer in the tab.`;
              break;
            }
            const now = current[column] ?? "";
            if (now === cell.before) writes.push({ row: rowNumber, column, value: cell.after });
            else if (!alreadyApplied(cell, now)) {
              problem = `“${cell.header || "A cell"}” was changed to “${now}” in Google Sheets since you edited it.`;
              break;
            }
          }
          if (problem) settle(change, "conflict", problem);
          else if (!writes.length || (await tryWrite([change], () => sheets.updateCells(spreadsheetId, tab.title, writes)))) {
            cache.delete(tab.sheetId);
            settle(change, "applied");
          }
        }
      } else if (rowNumber > 0) {
        if (await tryWrite([change], () => sheets.deleteRow(spreadsheetId, tab.sheetId, rowNumber))) settle(change, "applied");
        cache.delete(tab.sheetId);
      } else {
        settle(change, "conflict", rowNumber < 0 ? "More than one row matches the row you deleted, so none was deleted." : "The row you deleted was changed or is already gone, so nothing was deleted.");
      }
      index++;
      await flush();
    }
    await flush();
    return { applied, conflicts, error: null };
  } catch (error) {
    // Changes not yet applied go back in the queue; results already known are kept.
    const settled = new Set(batch.map((result) => result.id));
    for (const change of changes.slice(index)) if (!settled.has(change.id)) batch.push({ id: change.id, status: "pending", message: "" });
    try {
      await flush();
    } catch {
      // `report` keeps results it couldn't send and sends them before the next migration.
    }
    return { applied, conflicts, error };
  }
}
