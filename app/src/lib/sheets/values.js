import { inferTextType } from "../barcode/fields.js";
import { parseHttpUrl } from "../url.js";

/** @typedef {string | number | boolean} CellValue */

/**
 * Accepts a Google Sheets URL or a bare spreadsheet ID.
 * @param {string} input
 */
export function parseSpreadsheetId(input) {
  const value = input.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  const url = parseHttpUrl(value);
  const match = url?.host === "docs.google.com" && url.path.match(/^\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  throw new Error("Paste a Google Sheets spreadsheet link (docs.google.com/spreadsheets/…), not a Google Docs document link.");
}

/** Zero-based column index to A1 letters: 0 → A, 26 → AA. @param {number} index */
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

/** Quotes a tab title for use in an A1 range. @param {string} title */
export function quoteSheetName(title) {
  return `'${title.replaceAll("'", "''")}'`;
}

/**
 * Converts a typed scan field into the value written with RAW input, so numbers and
 * booleans keep their cell types while text (including `=…`) is never run as a formula.
 * @param {import("../barcode/fields.js").ScanField} field
 * @returns {CellValue}
 */
export function fieldToCell(field) {
  if (field.type === "Number" && field.value !== "" && Number.isFinite(Number(field.value))) return Number(field.value);
  if (field.type === "Boolean") return field.value.toLowerCase() === "true";
  return field.value;
}

/**
 * Converts text typed into the row editor the same way, so editing "42" stores a number
 * rather than the text "42".
 * @param {string} text
 * @returns {CellValue}
 */
export function textToCell(text) {
  const type = inferTextType(text.trim());
  if (type === "Number") return Number(text);
  if (type === "Boolean") return text.trim().toLowerCase() === "true";
  return text;
}
