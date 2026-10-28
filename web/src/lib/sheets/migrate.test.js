import { describe, expect, it, vi } from "vitest";
import { GoogleUnavailableError, SheetsPermissionError } from "../google/sheets-client.js";
import { columnFor, findRow, migrateChanges, placeRow } from "./migrate.js";

describe("placing stored values", () => {
  it("follows a column's heading to wherever it moved", () => {
    expect(columnFor(["Name", "Code", "Qty"], { column: 1, header: "code" })).toBe(1);
    expect(columnFor(["Qty", "Name", "Code"], { column: 1, header: "Code" })).toBe(2);
    expect(columnFor(["Name", "Qty"], { column: 1, header: "Code" })).toBe(-1);
    expect(columnFor(["Name", ""], { column: 1, header: "" })).toBe(1);
    expect(columnFor(["Name", "Added"], { column: 1, header: "" })).toBe(-1);
  });

  it("lays out a row under the current headings", () => {
    const cells = [
      { column: 0, header: "Code", value: "4006381333931" },
      { column: 2, header: "Qty", value: 3 },
    ];
    expect(placeRow(["Qty", "Name", "Code"], cells)).toEqual({ values: [3, "", "4006381333931"] });
    expect(placeRow(["Name"], cells)).toEqual({ error: "The column “Code” is no longer in the tab." });
  });

  it("finds a row by its contents", () => {
    const rows = [["Code", "Qty"], ["A", "1"], ["B", "2"], ["B", "2"], ["C", "3", ""]];
    expect(findRow(rows, 2, ["A", "1"])).toBe(2);
    expect(findRow(rows, 3, ["C", "3"])).toBe(5);
    expect(findRow(rows, 9, ["B", "2"])).toBe(-1);
    expect(findRow(rows, 3, ["B", "2"])).toBe(3);
    expect(findRow(rows, 2, ["Z", "9"])).toBe(0);
  });
});

/** A fake spreadsheet with one tab (sheetId 0, "Stock"). @param {string[][]} rows */
function fakeSheets(rows) {
  const data = rows.map((row) => [...row]);
  return {
    data,
    getSpreadsheet: vi.fn(async () => ({ spreadsheetId: "s", sheets: [{ properties: { sheetId: 0, title: "Stock" } }] })),
    getValues: vi.fn(async () => data.map((row) => [...row])),
    appendCells: vi.fn(async (/** @type {string} */ _id, /** @type {number} */ _sheetId, /** @type {any[][]} */ added) => {
      data.push(...added.map((row) => row.map(String)));
    }),
    updateCells: vi.fn(async (/** @type {string} */ _id, /** @type {string} */ _title, /** @type {any[]} */ cells) => {
      for (const { row, column, value } of cells) data[row - 1][column] = String(value);
    }),
    deleteRow: vi.fn(async (/** @type {string} */ _id, /** @type {number} */ _sheetId, /** @type {number} */ row) => {
      data.splice(row - 1, 1);
    }),
  };
}

const base = { sheetId: 0, sheetTitle: "Stock" };
const append = (/** @type {string} */ id, /** @type {any[]} */ cells) => /** @type {const} */ ({ ...base, id, kind: "append", payload: { cells } });

describe("migrating stored changes", () => {
  it("appends new rows in one request, under the right headings", async () => {
    const sheets = fakeSheets([["Qty", "Code"], ["1", "A"]]);
    const report = vi.fn(async () => {});
    const outcome = await migrateChanges({
      spreadsheetId: "s",
      sheets,
      report,
      changes: [
        append("c1", [{ column: 0, header: "Code", value: "B" }, { column: 1, header: "Qty", value: 2 }]),
        append("c2", [{ column: 0, header: "Code", value: "C" }]),
        append("c3", [{ column: 3, header: "Gone", value: "x" }]),
      ],
    });
    expect(outcome).toEqual({ applied: 2, conflicts: 1, error: null });
    expect(sheets.appendCells).toHaveBeenCalledOnce();
    expect(sheets.data).toEqual([["Qty", "Code"], ["1", "A"], ["2", "B"], ["", "C"]]);
    expect(report.mock.calls.flat(1)).toEqual([
      [
        { id: "c3", status: "conflict", message: "The column “Gone” is no longer in the tab." },
        { id: "c1", status: "applied", message: "" },
        { id: "c2", status: "applied", message: "" },
      ],
    ]);
  });

  it("applies an edit only where the cell still has its old value", async () => {
    const sheets = fakeSheets([["Code", "Qty"], ["X", "9"], ["A", "1"], ["B", "2"]]);
    const results = /** @type {any[]} */ ([]);
    await migrateChanges({
      spreadsheetId: "s",
      sheets,
      report: async (batch) => void results.push(...batch),
      changes: [
        // Row 2 was A,1 when edited; a row was inserted above it since, so it's now row 3.
        { ...base, id: "u1", kind: "update", payload: { row: 2, before: ["A", "1"], cells: [{ column: 1, header: "Qty", before: "1", after: 5 }] } },
        { ...base, id: "u2", kind: "update", payload: { row: 4, before: ["B", "3"], cells: [{ column: 1, header: "Qty", before: "3", after: 4 }] } },
      ],
    });
    expect(sheets.data[2]).toEqual(["A", "5"]);
    expect(sheets.data[3]).toEqual(["B", "2"]);
    expect(results).toEqual([
      { id: "u1", status: "applied", message: "" },
      { id: "u2", status: "conflict", message: "The row you edited was changed or removed in Google Sheets." },
    ]);
  });

  it("deletes the row with matching contents, and refuses when it's ambiguous", async () => {
    const sheets = fakeSheets([["Code"], ["A"], ["B"], ["B"]]);
    const results = /** @type {any[]} */ ([]);
    await migrateChanges({
      spreadsheetId: "s",
      sheets,
      report: async (batch) => void results.push(...batch),
      changes: [
        { ...base, id: "d1", kind: "delete-row", payload: { row: 3, before: ["A"] } },
        { ...base, id: "d2", kind: "delete-row", payload: { row: 9, before: ["B"] } },
      ],
    });
    expect(sheets.data).toEqual([["Code"], ["B"], ["B"]]);
    expect(results.map((result) => result.status)).toEqual(["applied", "conflict"]);
  });

  it("reports changes for a deleted tab as conflicts", async () => {
    const sheets = fakeSheets([["Code"]]);
    const results = /** @type {any[]} */ ([]);
    await migrateChanges({ spreadsheetId: "s", sheets, report: async (batch) => void results.push(...batch), changes: [{ ...append("a", []), sheetId: 7, sheetTitle: "Old" }] });
    expect(results).toEqual([{ id: "a", status: "conflict", message: "The tab “Old” no longer exists." }]);
  });

  it("hands the rest back when Google stops responding", async () => {
    const sheets = fakeSheets([["Code"]]);
    sheets.appendCells.mockRejectedValueOnce(new GoogleUnavailableError("Google Sheets is having trouble right now."));
    const results = /** @type {any[]} */ ([]);
    const outcome = await migrateChanges({
      spreadsheetId: "s",
      sheets,
      report: async (batch) => void results.push(...batch),
      changes: [append("a", [{ column: 0, header: "Code", value: "A" }]), { ...base, id: "d", kind: "delete-row", payload: { row: 2, before: ["A"] } }],
    });
    expect(outcome.error).toBeInstanceOf(GoogleUnavailableError);
    expect(results).toEqual([
      { id: "a", status: "pending", message: "" },
      { id: "d", status: "pending", message: "" },
    ]);
  });

  it("stops without changing anything when the account can't edit", async () => {
    const sheets = fakeSheets([["Code"]]);
    sheets.appendCells.mockRejectedValueOnce(new SheetsPermissionError("This Google account can view this spreadsheet but can't edit it.", "view-only"));
    const results = /** @type {any[]} */ ([]);
    const outcome = await migrateChanges({ spreadsheetId: "s", sheets, report: async (batch) => void results.push(...batch), changes: [append("a", [{ column: 0, header: "Code", value: "A" }])] });
    expect(outcome.error).toBeInstanceOf(SheetsPermissionError);
    expect(results).toEqual([{ id: "a", status: "pending", message: "" }]);
  });

  it("marks only the change Google rejected", async () => {
    const sheets = fakeSheets([["Code"], ["A"]]);
    sheets.deleteRow.mockRejectedValueOnce(new Error("Invalid requests[0].deleteDimension"));
    const results = /** @type {any[]} */ ([]);
    await migrateChanges({
      spreadsheetId: "s",
      sheets,
      report: async (batch) => void results.push(...batch),
      changes: [{ ...base, id: "d", kind: "delete-row", payload: { row: 2, before: ["A"] } }, append("a", [{ column: 0, header: "Code", value: "B" }])],
    });
    expect(results).toEqual([
      { id: "d", status: "conflict", message: "Invalid requests[0].deleteDimension" },
      { id: "a", status: "applied", message: "" },
    ]);
  });
});
