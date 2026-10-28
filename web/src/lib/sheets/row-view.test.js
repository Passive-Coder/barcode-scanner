import { describe, expect, it } from "vitest";
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
    expect(visibleRows(rows).map((row) => row.rowNumber)).toEqual([2, 3, 4, 5]);
  });

  it("finds rows by any cell, ignoring case", () => {
    expect(visibleRows(rows, { query: " A-" }).map((row) => row.cells[0])).toEqual(["Ann Lee", "Chitra"]);
    expect(visibleRows(rows, { query: "OKAFOR" }).map((row) => row.rowNumber)).toEqual([3]);
    expect(visibleRows(rows, { query: "nobody" })).toEqual([]);
  });

  it("puts the newest rows first when asked", () => {
    expect(visibleRows(rows, { newestFirst: true }).map((row) => row.rowNumber)).toEqual([5, 4, 3, 2]);
  });

  it("handles thousands of rows quickly", () => {
    const many = [["Code"], ...Array.from({ length: 20_000 }, (_, index) => [`CODE-${index}`])];
    const started = performance.now();
    expect(visibleRows(many, { query: "code-19999" })).toEqual([{ cells: ["CODE-19999"], rowNumber: 20_001 }]);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("rowSummary", () => {
  it("leads with the first value and lists the next few under their headings", () => {
    expect(rowSummary(rows[1], rows[0])).toEqual({ title: "Ann Lee", detail: "Email: ann@example.com · Ticket: A-1" });
    expect(rowSummary(["", "x", "y"], ["A", "", "C"], 1)).toEqual({ title: "x", detail: "C: y" });
    expect(rowSummary(["", ""], ["A", "B"])).toEqual({ title: "Empty row", detail: "" });
  });
});

describe("windowRange", () => {
  it("draws only what's on screen, plus a margin", () => {
    expect(windowRange({ scrollTop: 0, viewport: 400, itemHeight: 40, count: 5000, overscan: 5 })).toEqual({ start: 0, end: 15, before: 0, after: 4985 * 40 });
    expect(windowRange({ scrollTop: 4000, viewport: 400, itemHeight: 40, count: 5000, overscan: 5 })).toEqual({ start: 95, end: 115, before: 95 * 40, after: 4885 * 40 });
  });

  it("stays within the list at its ends and for short lists", () => {
    expect(windowRange({ scrollTop: 999_999, viewport: 400, itemHeight: 40, count: 50, overscan: 5 })).toEqual({ start: 50, end: 50, before: 2000, after: 0 });
    expect(windowRange({ scrollTop: 0, viewport: 0, itemHeight: 40, count: 3 })).toEqual({ start: 0, end: 3, before: 0, after: 0 });
  });
});
