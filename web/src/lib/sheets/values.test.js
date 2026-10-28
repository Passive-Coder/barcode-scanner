import { describe, expect, it } from "vitest";
import { columnLetter, fieldToCell, parseSpreadsheetId, quoteSheetName, textToCell } from "./values.js";

describe("parseSpreadsheetId", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";

  it.each([
    [`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`],
    [`https://docs.google.com/spreadsheets/u/1/d/${id}/edit`],
    [`  ${id}  `],
  ])("accepts %s", (input) => {
    expect(parseSpreadsheetId(input)).toBe(id);
  });

  it.each([
    [`https://docs.google.com/document/d/${id}/edit`],
    [`https://evil.example/spreadsheets/d/${id}`],
    ["not a link"],
  ])("rejects %s", (input) => {
    expect(() => parseSpreadsheetId(input)).toThrow(/Google Sheets/);
  });
});

describe("columnLetter", () => {
  it.each([[0, "A"], [25, "Z"], [26, "AA"], [51, "AZ"], [701, "ZZ"], [702, "AAA"]])("%i → %s", (index, letter) => {
    expect(columnLetter(index)).toBe(letter);
  });
});

describe("quoteSheetName", () => {
  it("escapes apostrophes", () => {
    expect(quoteSheetName("Bob's tab")).toBe("'Bob''s tab'");
  });
});

describe("cell conversion", () => {
  it("keeps numbers and booleans typed and everything else as text", () => {
    expect(fieldToCell({ key: "n", label: "n", value: "12.5", type: "Number" })).toBe(12.5);
    expect(fieldToCell({ key: "b", label: "b", value: "TRUE", type: "Boolean" })).toBe(true);
    expect(fieldToCell({ key: "t", label: "t", value: "=1+1", type: "Text" })).toBe("=1+1");
    expect(fieldToCell({ key: "e", label: "e", value: "", type: "Number" })).toBe("");
  });

  it("types edited text like a spreadsheet would, but keeps identifiers intact", () => {
    expect(textToCell("42")).toBe(42);
    expect(textToCell("false")).toBe(false);
    expect(textToCell("00123")).toBe("00123");
    expect(textToCell("")).toBe("");
  });
});
