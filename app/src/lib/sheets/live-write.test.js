import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SheetConflictError, appendPlaced, deletePlaced, updatePlaced } from "./live-write.js";
import { remapColumns } from "./mapping.js";

/** A fake tab that behaves like Google Sheets for the calls Linework makes. @param {string[][]} rows */
function fakeTab(rows) {
  const data = rows.map((row) => [...row]);
  const calls = { appendCells: 0, updateCells: 0, deleteRow: 0, getValues: 0 };
  /** Rows below the last row with data anywhere, as appendCells adds them. */
  const lastRowWithData = () => {
    for (let index = data.length - 1; index >= 0; index--) if (data[index].some((cell) => cell !== "")) return index + 1;
    return 0;
  };
  return {
    data,
    calls,
    /** @param {string} _id @param {string} _title @param {number[]} numbers */
    getRows: async (_id, _title, numbers) => numbers.map((row) => [...(data[row - 1] ?? [])]),
    getValues: async () => {
      calls.getValues++;
      return data.map((row) => [...row]);
    },
    /** @param {string} _id @param {number} _sheetId @param {any[][]} added */
    appendCells: async (_id, _sheetId, added) => {
      calls.appendCells++;
      data.splice(lastRowWithData(), 0, ...added.map((row) => row.map((value) => String(value))));
    },
    /** @param {string} _id @param {string} _title @param {Array<{ row: number, column: number, value: any }>} cells */
    updateCells: async (_id, _title, cells) => {
      calls.updateCells++;
      for (const { row, column, value } of cells) {
        while (data[row - 1].length <= column) data[row - 1].push("");
        data[row - 1][column] = String(value);
      }
    },
    /** @param {string} _id @param {number} _sheetId @param {number} row */
    deleteRow: async (_id, _sheetId, row) => {
      calls.deleteRow++;
      data.splice(row - 1, 1);
    },
  };
}

const tab = { sheetId: 0, title: "Stock" };
/** @param {ReturnType<typeof fakeTab>} sheets */
const base = (sheets) => ({ sheets, spreadsheetId: "s", tab });

describe("appending scans while others edit", () => {
  it("puts each value under its heading even if someone inserted a column", async () => {
    // Linework mapped Code to column A and Qty to B; someone has since inserted "Notes" at A.
    const sheets = fakeTab([["Notes", "Code", "Qty"], ["", "A1", "1"]]);
    const problems = await appendPlaced({ ...base(sheets), rows: [[{ column: 0, header: "Code", value: "B2" }, { column: 1, header: "Qty", value: 2 }]] });
    assert.deepEqual(problems, [""]);
    assert.deepEqual(sheets.data.at(-1), ["", "B2", "2"]);
  });

  it("adds below the last row with data, not into a gap in the middle", async () => {
    const sheets = fakeTab([["Code"], ["A"], [""], ["C"]]);
    await appendPlaced({ ...base(sheets), rows: [[{ column: 0, header: "Code", value: "D" }]] });
    assert.deepEqual(sheets.data, [["Code"], ["A"], [""], ["C"], ["D"]]);
  });

  it("never overwrites a row someone else added a moment earlier", async () => {
    const sheets = fakeTab([["Code"], ["A"]]);
    const scan = (/** @type {string} */ value) => appendPlaced({ ...base(sheets), rows: [[{ column: 0, header: "Code", value }]] });
    await Promise.all([scan("mine"), sheets.appendCells("s", 0, [["theirs"]]), scan("mine again")]);
    assert.deepEqual(sheets.data.slice(1).map((row) => row[0]).sort(), ["A", "mine", "mine again", "theirs"]);
  });

  it("writes rapid scans in one request and reports rows whose column is gone", async () => {
    const sheets = fakeTab([["Code", "Qty"]]);
    const problems = await appendPlaced({
      ...base(sheets),
      rows: [[{ column: 0, header: "Code", value: "A" }], [{ column: 2, header: "Lot", value: "L1" }], [{ column: 0, header: "Code", value: "B" }]],
    });
    assert.deepEqual(problems, ["", "The column “Lot” is no longer in the tab.", ""]);
    assert.equal(sheets.calls.appendCells, 1);
    assert.deepEqual(sheets.data.slice(1), [["A"], ["B"]]);
  });
});

describe("editing a row while others edit", () => {
  const edit = (/** @type {{ sheets: ReturnType<typeof fakeTab>, before?: string[], rowCount?: number }} */ options) => ({
    spreadsheetId: "s",
    tab,
    row: 3,
    before: ["B", "2"],
    cells: [{ column: 1, header: "Qty", before: "2", after: 5 }],
    rowCount: 3,
    ...options,
  });

  it("changes the row in place when nothing moved", async () => {
    const sheets = fakeTab([["Code", "Qty"], ["A", "1"], ["B", "2"]]);
    assert.equal(await updatePlaced(edit({ sheets })), 3);
    assert.deepEqual(sheets.data[2], ["B", "5"]);
    assert.equal(sheets.calls.getValues, 0);
  });

  it("follows the row when someone added a row above it", async () => {
    const sheets = fakeTab([["Code", "Qty"], ["New", "9"], ["A", "1"], ["B", "2"]]);
    assert.equal(await updatePlaced(edit({ sheets })), 4);
    assert.deepEqual(sheets.data[3], ["B", "5"]);
    assert.deepEqual(sheets.data[2], ["A", "1"]);
  });

  it("refuses to overwrite a cell someone else changed", async () => {
    const sheets = fakeTab([["Code", "Qty"], ["A", "1"], ["B", "7"]]);
    await assert.rejects(updatePlaced(edit({ sheets })), SheetConflictError);
    assert.deepEqual(sheets.data[2], ["B", "7"]);
    assert.equal(sheets.calls.updateCells, 0);
  });

  it("still changes its own cell when someone edited another cell of the same row", async () => {
    const sheets = fakeTab([["Code", "Qty", "Notes"], ["A", "1", ""], ["B", "2", "checked"]]);
    assert.equal(await updatePlaced(edit({ sheets, before: ["B", "2", ""] })), 3);
    assert.deepEqual(sheets.data[2], ["B", "5", "checked"]);
  });

  it("doesn't touch a different row that only looks similar after rows moved", async () => {
    // Same number of rows, but row 3 is now someone else's row that happens to share a Qty.
    const sheets = fakeTab([["Code", "Qty"], ["X", "2"], ["Y", "2"]]);
    await assert.rejects(updatePlaced(edit({ sheets })), SheetConflictError);
    assert.equal(sheets.calls.updateCells, 0);
  });
});

describe("deleting a row while others edit", () => {
  it("deletes the right row after rows above it were removed", async () => {
    const sheets = fakeTab([["Code"], ["B"], ["C"]]);
    assert.equal(await deletePlaced({ ...base(sheets), row: 4, before: ["C"] }), 3);
    assert.deepEqual(sheets.data, [["Code"], ["B"]]);
  });

  it("leaves a row someone else changed", async () => {
    const sheets = fakeTab([["Code"], ["A"], ["B (edited)"]]);
    await assert.rejects(deletePlaced({ ...base(sheets), row: 3, before: ["B"] }), SheetConflictError);
    assert.equal(sheets.calls.deleteRow, 0);
  });
});

describe("column mappings follow their columns", () => {
  const mapping = { 0: "raw", 1: "json.qty" };

  it("moves with an inserted column", () => {
    assert.deepEqual(remapColumns(mapping, ["Code", "Qty"], ["Notes", "Code", "Qty"]), { 1: "raw", 2: "json.qty" });
  });

  it("keeps a column renamed in place", () => {
    assert.deepEqual(remapColumns(mapping, ["Code", "Qty"], ["Code", "Quantity"]), mapping);
  });

  it("drops a deleted column and shifts the rest", () => {
    assert.deepEqual(remapColumns(mapping, ["Code", "Qty"], ["Qty"]), { 0: "json.qty" });
  });

  it("returns the same mapping when nothing moved", () => {
    assert.equal(remapColumns(mapping, ["Code", "Qty"], ["Code", "Qty", "Added"]), mapping);
  });
});
