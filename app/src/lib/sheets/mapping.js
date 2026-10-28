import { columnFor } from "./migrate.js";

/**
 * Keeps a column mapping (column index → barcode field) on the same columns when the tab's
 * columns change, for example when someone inserts, moves, or deletes a column in Google Sheets.
 * Columns are recognised by their heading:
 * - a heading that moved takes its field with it;
 * - a heading renamed in place (no columns added or removed) keeps its field;
 * - a heading that's gone after columns were removed loses its field.
 * Unnamed columns can't be told apart, so they keep their position.
 *
 * @param {Record<number, string>} mapping
 * @param {string[]} before the headings the mapping was made for
 * @param {string[]} after the headings now
 * @returns {Record<number, string>} the same object if nothing needs to move
 */
export function remapColumns(mapping, before, after) {
  const entries = Object.entries(mapping).map(([column, field]) => ({ column: Number(column), field }));
  if (!entries.length) return mapping;
  const resized = before.length !== after.length;
  /** @type {Record<number, string>} */
  const next = {};
  let moved = false;
  for (const { column, field } of entries) {
    const header = before[column] ?? "";
    let target = header.trim() ? columnFor(after, { column, header }) : column;
    if (target < 0) target = resized ? -1 : column;
    if (target !== column) moved = true;
    if (target >= 0 && !(target in next)) next[target] = field;
    else if (target >= 0) moved = true;
  }
  return moved ? next : mapping;
}
