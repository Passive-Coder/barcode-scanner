import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GoogleUnavailableError, SheetsPermissionError } from "../google/sheets-client.js";
import { columnFor, findRow, migrateChanges, placeRow } from "./migrate.js";

describe("placing stored values", () => {
  it("follows a column's heading to wherever it moved", () => {
    assert.equal(columnFor(["Name", "Code", "Qty"], { column: 1, header: "code" }), 1);
    assert.equal(columnFor(["Qty", "Name", "Code"], { column: 1, header: "Code" }), 2);
    assert.equal(columnFor(["Name", "Qty"], { column: 1, header: "Code" }), -1);
    assert.equal(columnFor(["Name", ""], { column: 1, header: "" }), 1);
  });

  it("lays out a row under the current headings", () => {
    const cells = [
      { column: 0, header: "Code", value: "4006381333931" },
      { column: 2, header: "Qty", value: 3 },
    ];
    assert.deepEqual(placeRow(["Qty", "Name", "Code"], cells), { values: [3, "", "4006381333931"] });
    assert.deepEqual(placeRow(["Name"], cells), { error: "The column “Code” is no longer in the tab." });
  });

  it("finds a row by its contents", () => {
    const rows = [["Code", "Qty"], ["A", "1"], ["B", "2"], ["B", "2"], ["C", "3", ""]];
    assert.equal(findRow(rows, 2, ["A", "1"]), 2);
    assert.equal(findRow(rows, 3, ["C", "3"]), 5);
    assert.equal(findRow(rows, 9, ["B", "2"]), -1);
    assert.equal(findRow(rows, 2, ["Z", "9"]), 0);
  });
});

/** A fake spreadsheet with one tab (sheetId 0, "Stock"). @param {string[][]} rows */
function fakeSheets(rows) {
  const data = rows.map((row) => [...row]);
  /** @type {Error | null} */
  let failNextAppend = null;
  return {
    data,
    /** @param {Error} error */
    failAppendOnce(error) {
      failNextAppend = error;
    },
    appendCalls: 0,
    getSpreadsheet: async () => ({ spreadsheetId: "s", sheets: [{ properties: { sheetId: 0, title: "Stock" } }] }),
    getValues: async () => data.map((row) => [...row]),
    /** @param {string} _id @param {number} _sheetId @param {any[][]} added */
    async appendCells(_id, _sheetId, added) {
      this.appendCalls++;
      if (failNextAppend) {
        const error = failNextAppend;
        failNextAppend = null;
        throw error;
      }
      data.push(...added.map((row) => row.map(String)));
    },
    /** @param {string} _id @param {string} _title @param {any[]} cells */
    async updateCells(_id, _title, cells) {
      for (const { row, column, value } of cells) data[row - 1][column] = String(value);
    },
    /** @param {string} _id @param {number} _sheetId @param {number} row */
    async deleteRow(_id, _sheetId, row) {
      data.splice(row - 1, 1);
    },
  };
}

const base = { sheetId: 0, sheetTitle: "Stock" };
/** @param {string} id @param {any[]} cells */
const append = (id, cells) => /** @type {const} */ ({ ...base, id, kind: "append", payload: { cells } });

/** @param {ReturnType<typeof fakeSheets>} sheets @param {any[]} changes */
async function run(sheets, changes) {
  /** @type {any[]} */
  const results = [];
  const outcome = await migrateChanges({ spreadsheetId: "s", sheets: /** @type {any} */ (sheets), changes, report: async (batch) => void results.push(...batch) });
  return { outcome, results };
}

describe("migrating stored changes", () => {
  it("appends new rows in one request, under the right headings", async () => {
    const sheets = fakeSheets([["Qty", "Code"], ["1", "A"]]);
    const { outcome } = await run(sheets, [
      append("c1", [{ column: 0, header: "Code", value: "B" }, { column: 1, header: "Qty", value: 2 }]),
      append("c2", [{ column: 0, header: "Code", value: "C" }]),
      append("c3", [{ column: 3, header: "Gone", value: "x" }]),
    ]);
    assert.deepEqual(outcome, { applied: 2, conflicts: 1, error: null });
    assert.equal(sheets.appendCalls, 1);
    assert.deepEqual(sheets.data, [["Qty", "Code"], ["1", "A"], ["2", "B"], ["", "C"]]);
  });

  it("applies an edit only where the cell still has its old value", async () => {
    const sheets = fakeSheets([["Code", "Qty"], ["X", "9"], ["A", "1"], ["B", "2"]]);
    const { results } = await run(sheets, [
      { ...base, id: "u1", kind: "update", payload: { row: 2, before: ["A", "1"], cells: [{ column: 1, header: "Qty", before: "1", after: 5 }] } },
      { ...base, id: "u2", kind: "update", payload: { row: 4, before: ["B", "3"], cells: [{ column: 1, header: "Qty", before: "3", after: 4 }] } },
    ]);
    assert.deepEqual(sheets.data[2], ["A", "5"]);
    assert.deepEqual(sheets.data[3], ["B", "2"]);
    assert.deepEqual(results.map((result) => result.status), ["applied", "conflict"]);
  });

  it("hands the rest back when Google stops responding", async () => {
    const sheets = fakeSheets([["Code"]]);
    sheets.failAppendOnce(new GoogleUnavailableError("Google Sheets is having trouble right now."));
    const { outcome, results } = await run(sheets, [append("a", [{ column: 0, header: "Code", value: "A" }]), { ...base, id: "d", kind: "delete-row", payload: { row: 2, before: ["A"] } }]);
    assert.ok(outcome.error instanceof GoogleUnavailableError);
    assert.deepEqual(results, [
      { id: "a", status: "pending", message: "" },
      { id: "d", status: "pending", message: "" },
    ]);
  });

  it("stops without changing anything when the account can't edit", async () => {
    const sheets = fakeSheets([["Code"]]);
    sheets.failAppendOnce(new SheetsPermissionError("This Google account can view this spreadsheet but can't edit it.", "view-only"));
    const { outcome, results } = await run(sheets, [append("a", [{ column: 0, header: "Code", value: "A" }])]);
    assert.ok(outcome.error instanceof SheetsPermissionError);
    assert.deepEqual(results, [{ id: "a", status: "pending", message: "" }]);
  });
});
