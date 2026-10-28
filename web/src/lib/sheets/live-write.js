import { columnFor, findRow, placeRow, sameRow } from "./migrate.js";

/**
 * Writes to a tab other people may be editing at the same moment. Linework's copy of the rows
 * can be a few seconds old, so every write is checked against Google Sheets just before it's made:
 * - new rows (scans, Add row) go below the last row with data, with each value under its column's
 *   heading as it is now, so a column someone inserted or moved can't shift them;
 * - an edit or a delete finds its row by its contents if rows were added or removed above it;
 * - a cell someone else has changed since it was loaded is never overwritten.
 * Sheets has no conditional writes, so a change made in the instant between the check and the
 * write can still slip through; the check makes that window a fraction of a second.
 *
 * @typedef {import("./values.js").CellValue} CellValue
 * @typedef {import("./migrate.js").AppendCell} AppendCell
 * @typedef {import("./migrate.js").UpdateCell} UpdateCell
 * @typedef {Pick<import("../google/sheets-client.js").SheetsClient, "getRows" | "getValues" | "appendCells" | "updateCells" | "deleteRow">} LiveSheetsApi
 * @typedef {{ sheetId: number, title: string }} TabRef
 */

/** Someone else's change got there first; nothing was written. */
export class SheetConflictError extends Error {
  name = "SheetConflictError";
}

/**
 * Adds rows under the tab's current headings. Rows whose column is gone are left out.
 * @param {{ sheets: LiveSheetsApi, spreadsheetId: string, tab: TabRef, rows: AppendCell[][] }} options
 * @returns {Promise<string[]>} for each row, why it couldn't be added, or "" if it was
 */
export async function appendPlaced({ sheets, spreadsheetId, tab, rows }) {
  const [headers] = await sheets.getRows(spreadsheetId, tab.title, [1]);
  const placed = rows.map((cells) => placeRow(headers, cells));
  /** @type {CellValue[][]} */
  const ready = placed.flatMap((row) => ("error" in row ? [] : [row.values]));
  if (ready.length) await sheets.appendCells(spreadsheetId, tab.sheetId, ready);
  return placed.map((row) => ("error" in row ? row.error : ""));
}

/** How much of a row has to be unchanged to be sure it's still the same row. */
const SAME_ROW_SHARE = 0.5;

/**
 * Finds the row a change was made on, as it is in Google Sheets now.
 * @param {{ sheets: LiveSheetsApi, spreadsheetId: string, tab: TabRef, row: number, before: string[], rowCount: number, changing?: number[] }} options
 *   rowCount: rows in Linework's copy (headings included); changing: columns the change writes
 * @returns {Promise<{ rowNumber: number, headers: string[], current: string[] }>}
 */
async function locateRow({ sheets, spreadsheetId, tab, row, before, rowCount, changing = [] }) {
  const [headers, current] = await sheets.getRows(spreadsheetId, tab.title, [1, row]);
  if (sameRow(current, before)) return { rowNumber: row, headers, current };

  const rows = await sheets.getValues(spreadsheetId, tab.title);
  const found = findRow(rows, row, before);
  if (found > 0) return { rowNumber: found, headers: rows[0] ?? [], current: rows[found - 1] ?? [] };
  if (found < 0) throw new SheetConflictError("More than one row now holds the same values as this one, so Linework can't tell which to change.");

  // No row matches exactly. If no rows were added or removed, it's this row with other cells
  // edited by someone else, provided most of what was in it is still there.
  const there = rows[row - 1] ?? [];
  const others = before.flatMap((value, column) => (value !== "" && !changing.includes(column) ? [column] : []));
  const kept = others.filter((column) => (there[column] ?? "") === before[column]).length;
  if (rows.length === rowCount && there.length && (!others.length || kept / others.length >= SAME_ROW_SHARE)) {
    return { rowNumber: row, headers: rows[0] ?? [], current: there };
  }
  throw new SheetConflictError("This row was changed or removed in Google Sheets since it was loaded.");
}

/**
 * Changes cells of one row, only where they still hold the values they had when loaded.
 * @param {{ sheets: LiveSheetsApi, spreadsheetId: string, tab: TabRef, row: number, before: string[], cells: UpdateCell[], rowCount: number }} options
 * @returns {Promise<number>} the row's number now
 */
export async function updatePlaced({ sheets, spreadsheetId, tab, row, before, cells, rowCount }) {
  const { rowNumber, headers, current } = await locateRow({ sheets, spreadsheetId, tab, row, before, rowCount, changing: cells.map((cell) => cell.column) });
  /** @type {Array<{ row: number, column: number, value: CellValue }>} */
  const writes = [];
  for (const cell of cells) {
    const column = columnFor(headers, cell);
    if (column < 0) throw new SheetConflictError(`The column “${cell.header}” is no longer in the tab.`);
    const now = current[column] ?? "";
    if (now === cell.before) writes.push({ row: rowNumber, column, value: cell.after });
    else if (now !== String(cell.after ?? "")) {
      throw new SheetConflictError(`${cell.header ? `“${cell.header}”` : "This cell"} in row ${rowNumber} was just changed to “${now || "blank"}” by someone else, so your change wasn't saved.`);
    }
  }
  if (writes.length) await sheets.updateCells(spreadsheetId, tab.title, writes);
  return rowNumber;
}

/**
 * Deletes one row, wherever it is now, and only if nobody has changed it since it was loaded.
 * @param {{ sheets: LiveSheetsApi, spreadsheetId: string, tab: TabRef, row: number, before: string[] }} options
 * @returns {Promise<number>} the number the row had when it was deleted
 */
export async function deletePlaced({ sheets, spreadsheetId, tab, row, before }) {
  const [current] = await sheets.getRows(spreadsheetId, tab.title, [row]);
  let rowNumber = row;
  if (!sameRow(current, before)) {
    rowNumber = findRow(await sheets.getValues(spreadsheetId, tab.title), row, before);
    if (rowNumber === 0) throw new SheetConflictError("This row was changed or removed in Google Sheets since it was loaded, so it wasn't deleted.");
    if (rowNumber < 0) throw new SheetConflictError("More than one row holds the same values as this one, so none was deleted.");
  }
  await sheets.deleteRow(spreadsheetId, tab.sheetId, rowNumber);
  return rowNumber;
}
