const API = "https://sheets.googleapis.com/v4/spreadsheets";

export function parseSpreadsheetId(input) {
  const value = input.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname !== "docs.google.com") throw new Error();
    const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  } catch { /* A clear error is returned below. */ }
  throw new Error("Paste a Google Sheets spreadsheet link, not a Google Docs document link.");
}

export function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function sheetName(title) {
  return `'${title.replaceAll("'", "''")}'`;
}

export class SheetsClient {
  constructor(auth) { this.auth = auth; }

  async request(path, { method = "GET", body } = {}) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.auth.getToken()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json()).error?.message || ""; } catch { /* HTTP status is enough. */ }
      if (response.status === 401) throw new Error("Google access expired. Select Connect Google to sign in again.");
      if (response.status === 403) throw new Error(detail || "Google denied access. Check the account, Sheets API, and spreadsheet sharing.");
      if (response.status === 404) throw new Error("Spreadsheet not found. Check the link and account access.");
      throw new Error(detail || `Google Sheets request failed (${response.status}).`);
    }
    return response.status === 204 ? {} : response.json();
  }

  getSpreadsheet(id) {
    return this.request(`/${encodeURIComponent(id)}?fields=spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`);
  }

  async getSheetValues(id, title) {
    const range = `${sheetName(title)}!1:1000`;
    const result = await this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    return result.values || [];
  }

  updateCell(id, title, row, column, value) {
    const range = `${sheetName(title)}!${columnLetter(column)}${row}`;
    return this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT", body: { range, majorDimension: "ROWS", values: [[String(value)]] },
    });
  }

  updateRow(id, title, row, values) {
    const range = `${sheetName(title)}!A${row}:${columnLetter(values.length - 1)}${row}`;
    return this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT", body: { range, majorDimension: "ROWS", values: [values.map(String)] },
    });
  }

  appendRow(id, title, values) {
    const range = `${sheetName(title)}!A1`;
    return this.request(`/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST", body: { majorDimension: "ROWS", values: [values.map((value) => value ?? "")] },
    });
  }

  batchUpdate(id, requests) {
    return this.request(`/${encodeURIComponent(id)}:batchUpdate`, {
      method: "POST", body: { requests },
    });
  }

  addSheet(id, title) {
    return this.batchUpdate(id, [{ addSheet: { properties: { title } } }]);
  }

  renameSheet(id, sheetId, title) {
    return this.batchUpdate(id, [{ updateSheetProperties: { properties: { sheetId, title }, fields: "title" } }]);
  }

  deleteSheet(id, sheetId) {
    return this.batchUpdate(id, [{ deleteSheet: { sheetId } }]);
  }

  deleteColumn(id, sheetId, index) {
    return this.batchUpdate(id, [{ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 } } }]);
  }

  appendColumn(id, sheetId) {
    return this.batchUpdate(id, [{ appendDimension: { sheetId, dimension: "COLUMNS", length: 1 } }]);
  }

  deleteRow(id, sheetId, row) {
    return this.batchUpdate(id, [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }]);
  }
}
