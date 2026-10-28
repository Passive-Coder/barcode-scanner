import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rowSummary, visibleRows, windowRange } from "./row-view.js";

const rows = [
  ["Name", "Email", "Ticket"],
  ["Ann Lee", "ann@example.com", "A-1"],
  ["Ben Okafor", "ben@example.com", "B-2"],
  ["", "", ""],
  ["Chitra", "chitra@example.com", "a-3"],
];

describe("visibleRows", () => {
  it("lists data rows with their sheet row numbers", () => {
    assert.deepEqual(visibleRows(rows).map((row) => row.rowNumber), [2, 3, 4, 5]);
  });

  it("finds rows by any cell, ignoring case", () => {
    assert.deepEqual(visibleRows(rows, { query: " A-" }).map((row) => row.cells[0]), ["Ann Lee", "Chitra"]);
    assert.deepEqual(visibleRows(rows, { query: "OKAFOR" }).map((row) => row.rowNumber), [3]);
    assert.deepEqual(visibleRows(rows, { query: "nobody" }), []);
  });

  it("puts the newest rows first when asked", () => {
    assert.deepEqual(visibleRows(rows, { newestFirst: true }).map((row) => row.rowNumber), [5, 4, 3, 2]);
  });

  it("handles thousands of rows quickly", () => {
    const many = [["Code"], ...Array.from({ length: 20_000 }, (_, index) => [`CODE-${index}`])];
    const started = performance.now();
    assert.deepEqual(visibleRows(many, { query: "code-19999" }), [{ cells: ["CODE-19999"], rowNumber: 20_001 }]);
    assert.ok(performance.now() - started < 200);
  });
});

describe("rowSummary", () => {
  it("leads with the first value and lists the next few under their headings", () => {
    assert.deepEqual(rowSummary(rows[1], rows[0]), { title: "Ann Lee", detail: "Email: ann@example.com · Ticket: A-1" });
    assert.deepEqual(rowSummary(["", "x", "y"], ["A", "", "C"], 1), { title: "x", detail: "C: y" });
    assert.deepEqual(rowSummary(["", ""], ["A", "B"]), { title: "Empty row", detail: "" });
  });
});

describe("windowRange", () => {
  it("draws only what's on screen, plus a margin", () => {
    assert.deepEqual(windowRange({ scrollTop: 0, viewport: 400, itemHeight: 40, count: 5000, overscan: 5 }), { start: 0, end: 15, before: 0, after: 4985 * 40 });
    assert.deepEqual(windowRange({ scrollTop: 4000, viewport: 400, itemHeight: 40, count: 5000, overscan: 5 }), { start: 95, end: 115, before: 95 * 40, after: 4885 * 40 });
  });

  it("stays within the list at its ends and for short lists", () => {
    assert.deepEqual(windowRange({ scrollTop: 999_999, viewport: 400, itemHeight: 40, count: 50, overscan: 5 }), { start: 50, end: 50, before: 2000, after: 0 });
    assert.deepEqual(windowRange({ scrollTop: 0, viewport: 0, itemHeight: 40, count: 3 }), { start: 0, end: 3, before: 0, after: 0 });
  });
});
