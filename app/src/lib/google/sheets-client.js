import { SHEET_ROW_LIMIT } from "../config.js";
import { fetchWithTimeout, isTimeout } from "../net.js";
import { columnLetter, quoteSheetName } from "../sheets/values.js";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * @typedef {import("../sheets/values.js").CellValue} CellValue
 * @typedef {{ sheetId: number, title: string, gridProperties?: { rowCount?: number, columnCount?: number } }} SheetProperties
 * @typedef {{ spreadsheetId: string, spreadsheetUrl?: string, properties?: { title?: string }, sheets?: Array<{ properties: SheetProperties }> }} SpreadsheetMetadata
 * @typedef {{
 *   getToken: () => Promise<string>,
 *   onUnauthorized: (token: string) => Promise<boolean>,
 * }} GoogleCredentials `onUnauthorized` is told Google refused a token; it resolves true if a fresh one can be tried
 */

/** The Google session lapsed. Used for every Google API, not only Sheets. */
export class SheetsAuthError extends Error {
  name = "SheetsAuthError";
}

/**
 * Google couldn't be reached or is overloaded (network failure, timeout, 429, or 5xx): the
 * request may well work later, so changes can be stored and migrated instead of being lost.
 */
export class GoogleUnavailableError extends Error {
  name = "GoogleUnavailableError";
}

/**
 * Whether a failed write could succeed later without anything changing on the person's side
 * except Google coming back or them reconnecting.
 * @param {unknown} error
 */
export const isRetryable = (error) => error instanceof GoogleUnavailableError || error instanceof SheetsAuthError;

/**
 * The signed-in account isn't allowed to do this to the spreadsheet: `view-only` when it can
 * read but not edit (a Viewer or Commenter), `no-access` when it can't open it at all.
 */
export class SheetsPermissionError extends Error {
  name = "SheetsPermissionError";

  /** @param {string} message @param {"view-only" | "no-access"} access */
  constructor(message, access) {
    super(message);
    this.access = access;
  }
}

/**
 * Turns a 403 from the Sheets API into an error a person can act on. Google's own text
 * ("The caller does not have permission") doesn't say what to do about it.
 * @param {string} detail Google's error message
 * @param {string} method HTTP method of the failed request
 */
export function permissionError(detail, method) {
  if (/insufficient authentication scopes/i.test(detail)) {
    return new Error("Linework isn't allowed to use your Google Sheets. Sign out, sign in again, and allow access to your spreadsheets.");
  }
  if (/protected/i.test(detail)) {
    return new Error("That part of the sheet is protected. Ask the spreadsheet's owner to remove the protection or let you edit it.");
  }
  if (/API has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
    return new Error("The Google Sheets API isn't enabled for this app's Google Cloud project.");
  }
  if (method === "GET") {
    return new SheetsPermissionError("This Google account can't open this spreadsheet. Ask for access or choose a sheet shared with this account.", "no-access");
  }
  return new SheetsPermissionError("This Google account can view this spreadsheet but can't edit it. Ask for Editor access to make changes.", "view-only");
}

/**
 * A value as Sheets API cell data: typed, and text is never read as a formula.
 * @param {CellValue} value
 */
function toCellData(value) {
  if (value === "" || value === null || value === undefined) return {};
  if (typeof value === "number") return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: String(value) } };
}

/**
 * Google Sheets REST client. Every request asks the auth layer for a live token; if Google
 * refuses one, the request is retried once with a fresh token where the platform can get one.
 * (Shared with the website: web/src/lib/google/sheets-client.js.)
 */
export class SheetsClient {
  /** @param {GoogleCredentials} auth */
  constructor({ getToken, onUnauthorized }) {
    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
  }

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown }} [options]
   */
  async request(path, { method = "GET", body } = {}) {
    let response;
    for (let attempt = 0; ; attempt++) {
      const token = await this.getToken();
      try {
        response = await fetchWithTimeout(
          `${API}${path}`,
          {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
          },
          REQUEST_TIMEOUT_MS,
        );
      } catch (error) {
        if (isTimeout(error)) throw new GoogleUnavailableError("Google Sheets took too long to respond. Check your connection and try again.");
        throw new GoogleUnavailableError("Could not reach Google Sheets. Check your connection and try again.");
      }
      if (response.status !== 401) break;
      if (attempt > 0 || !(await this.onUnauthorized(token))) throw new SheetsAuthError("Your Google session expired. Reconnect Google to continue.");
    }

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json()).error?.message ?? "";
      } catch {
        /* The status code is enough. */
      }
      if (response.status === 403) throw permissionError(detail, method);
      if (response.status === 404) throw new Error("Spreadsheet not found. Check the link and that this Google account can open it.");
      if (response.status === 429) throw new GoogleUnavailableError("Google Sheets is rate limiting requests. Wait a moment and try again.");
      if (response.status >= 500) throw new GoogleUnavailableError("Google Sheets is having trouble right now. Try again in a moment.");
      throw new Error(detail || `Google Sheets request failed (${response.status}).`);
    }
    return response.status === 204 ? {} : response.json();
  }

  /** @param {string} id @returns {Promise<SpreadsheetMetadata>} */
  getSpreadsheet(id) {
    const fields = "spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))";
    return this.request(`/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`);
  }

  /** @param {string} id @param {string} title @returns {Promise<string[][]>} */
  async getValues(id, title) {
    const range = `${quoteSheetName(title)}!1:${SHEET_ROW_LIMIT}`;
    const result = await this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    return result.values ?? [];
  }

  /**
   * Reads whole rows by number in one request, for checking a few rows just before a write.
   * @param {string} id @param {string} title @param {number[]} rowNumbers 1-based
   * @returns {Promise<string[][]>} one array per requested row, empty for a blank row
   */
  async getRows(id, title, rowNumbers) {
    const ranges = rowNumbers.map((row) => `ranges=${encodeURIComponent(`${quoteSheetName(title)}!${row}:${row}`)}`).join("&");
    const result = await this.request(`/${encodeURIComponent(id)}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`);
    return rowNumbers.map((_, index) => result.valueRanges?.[index]?.values?.[0] ?? []);
  }

  /**
   * Writes individual cells in one request. RAW input keeps text such as `=…` from becoming a formula.
   * @param {string} id @param {string} title
   * @param {Array<{ row: number, column: number, value: CellValue }>} cells 1-based row, 0-based column
   */
  updateCells(id, title, cells) {
    return this.request(`/${encodeURIComponent(id)}/values:batchUpdate`, {
      method: "POST",
      body: {
        valueInputOption: "RAW",
        data: cells.map(({ row, column, value }) => ({
          range: `${quoteSheetName(title)}!${columnLetter(column)}${row}`,
          majorDimension: "ROWS",
          values: [[value]],
        })),
      },
    });
  }

  /** @param {string} id @param {string} title @param {CellValue[]} values */
  appendRow(id, title, values) {
    return this.appendRows(id, title, [values]);
  }

  /**
   * Adds rows after the last row of the tab's data, inserting new rows so nothing below is overwritten.
   * @param {string} id @param {string} title @param {CellValue[][]} rows
   */
  appendRows(id, title, rows) {
    const range = `${quoteSheetName(title)}!A1`;
    return this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: { majorDimension: "ROWS", values: rows },
    });
  }

  /**
   * Adds rows below the last row that has data anywhere in the tab, starting at column A. Google
   * applies each request on its own, so rows added at the same time by other people land one
   * after another instead of over each other. Values are stored as typed, never as formulas.
   * @param {string} id @param {number} sheetId @param {CellValue[][]} rows
   */
  appendCells(id, sheetId, rows) {
    return this.batchUpdate(id, [{ appendCells: { sheetId, rows: rows.map((values) => ({ values: values.map(toCellData) })), fields: "userEnteredValue" } }]);
  }

  /** @param {string} id @param {object[]} requests */
  batchUpdate(id, requests) {
    return this.request(`/${encodeURIComponent(id)}:batchUpdate`, { method: "POST", body: { requests } });
  }

  /** @param {string} id @param {string} title @returns {Promise<number | undefined>} the new tab's sheetId */
  async addSheet(id, title) {
    const result = await this.batchUpdate(id, [{ addSheet: { properties: { title } } }]);
    return result.replies?.[0]?.addSheet?.properties?.sheetId;
  }

  /** @param {string} id @param {number} sheetId @param {string} title */
  renameSheet(id, sheetId, title) {
    return this.batchUpdate(id, [{ updateSheetProperties: { properties: { sheetId, title }, fields: "title" } }]);
  }

  /** @param {string} id @param {number} sheetId */
  deleteSheet(id, sheetId) {
    return this.batchUpdate(id, [{ deleteSheet: { sheetId } }]);
  }

  /** @param {string} id @param {number} sheetId */
  appendColumn(id, sheetId) {
    return this.batchUpdate(id, [{ appendDimension: { sheetId, dimension: "COLUMNS", length: 1 } }]);
  }

  /** @param {string} id @param {number} sheetId @param {number} index 0-based */
  deleteColumn(id, sheetId, index) {
    return this.batchUpdate(id, [{ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 } } }]);
  }

  /** @param {string} id @param {number} sheetId @param {number} row 1-based */
  deleteRow(id, sheetId, row) {
    return this.batchUpdate(id, [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }]);
  }
}
