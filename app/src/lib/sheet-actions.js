import { dialogs } from "../stores/dialogs.js";
import { workspace } from "../stores/workspace.js";
import { attempt } from "./feedback.js";
import { columnLetter } from "./sheets/values.js";

/**
 * User flows that pair a confirmation or form with a workspace change. Components call these
 * from press handlers; the workspace store stays free of UI concerns. (Mirrors the website's.)
 */

/** @param {string} label @param {string} value */
function required(label, value) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} cannot be empty.`);
  return trimmed;
}

/**
 * @param {{ title: string, label: string, value?: string, submitLabel?: string, save: (value: string) => Promise<void> }} options
 */
function editText({ title, label, value = "", submitLabel, save }) {
  return dialogs.edit({
    title,
    submitLabel,
    fields: [{ label, value }],
    onSubmit: ([text]) => save(required(label, text)),
  });
}

export const addTab = () =>
  editText({ title: "Add a sheet tab", label: "Tab name", submitLabel: "Add tab", save: (title) => workspace.addTab(title) });

export const renameTab = () =>
  editText({ title: "Rename sheet tab", label: "Tab name", value: workspace.tab?.title, save: (title) => workspace.renameTab(title) });

export async function deleteTab() {
  const tab = workspace.tab;
  if (!tab) return;
  if (workspace.tabs.length <= 1) {
    await dialogs.confirm({ title: "This is the only tab", message: "A spreadsheet must keep at least one tab, so this one can't be deleted.", confirmLabel: "OK", notice: true });
    return;
  }
  const confirmed = await dialogs.confirm({
    title: `Delete “${tab.title}”?`,
    message: "The entire tab and all of its data will be removed from the spreadsheet. This can't be undone here.",
    confirmLabel: "Delete tab",
    danger: true,
  });
  if (confirmed) await attempt(() => workspace.deleteTab(), "Could not delete tab");
}

export const addColumn = () =>
  editText({ title: "Add a column", label: "Column heading", submitLabel: "Add column", save: (heading) => workspace.addColumn(heading) });

/** @param {number} index */
export const renameColumn = (index) =>
  editText({ title: `Rename column ${columnLetter(index)}`, label: "Column heading", value: workspace.headers[index], save: (heading) => workspace.renameColumn(index, heading) });

/** @param {number} index */
export async function deleteColumn(index) {
  const heading = workspace.headers[index];
  const confirmed = await dialogs.confirm({
    title: `Delete column ${columnLetter(index)}?`,
    message: `${heading ? `“${heading}” and all` : "All"} of its values will be removed, and columns to its right will shift left.`,
    confirmLabel: "Delete column",
    danger: true,
  });
  if (confirmed) await attempt(() => workspace.deleteColumn(index), "Could not delete column");
}

/** @param {number | null} rowNumber 1-based sheet row, or null for a new row */
export function editRow(rowNumber) {
  if (!workspace.columnCount) {
    return dialogs.confirm({ title: "Add a column first", message: "Rows need at least one column heading. Add a column, then add rows.", confirmLabel: "OK", notice: true });
  }
  const current = rowNumber ? (workspace.rows[rowNumber - 1] ?? []) : [];
  return dialogs.edit({
    title: rowNumber ? `Edit row ${rowNumber}` : "Add a row",
    description: "Values are written directly to the selected Google Sheet. Numbers and TRUE/FALSE keep their cell types.",
    submitLabel: rowNumber ? "Save changes" : "Add row",
    fields: Array.from({ length: workspace.columnCount }, (_, column) => ({
      label: workspace.headers[column] || `Column ${columnLetter(column)}`,
      value: current[column] ?? "",
    })),
    onSubmit: (values) => workspace.saveRow(rowNumber, values),
  });
}

/** Shows every value in a row, for anyone who can view the sheet but not edit it. @param {number} rowNumber */
export function viewRow(rowNumber) {
  const cells = workspace.rows[rowNumber - 1] ?? [];
  const lines = Array.from({ length: workspace.columnCount }, (_, column) => `${workspace.headers[column] || `Column ${columnLetter(column)}`}: ${cells[column] || "—"}`);
  return dialogs.confirm({ title: `Row ${rowNumber}`, message: lines.join("\n"), confirmLabel: "Close", notice: true });
}

/** @param {number} rowNumber */
export async function deleteRow(rowNumber) {
  const confirmed = await dialogs.confirm({
    title: `Delete row ${rowNumber}?`,
    message: "The row and all of its values will be removed, and rows below it will move up.",
    confirmLabel: "Delete row",
    danger: true,
  });
  if (confirmed) await attempt(() => workspace.deleteRow(rowNumber), "Could not delete row");
}

/** @param {string} id */
export async function forgetLink(id) {
  const link = workspace.links.find((item) => item.id === id);
  const confirmed = await dialogs.confirm({
    title: `Forget “${link?.title ?? "this spreadsheet"}”?`,
    message: "The link is removed from this phone only. The spreadsheet itself is not changed.",
    confirmLabel: "Forget link",
  });
  if (confirmed) workspace.removeLink(id);
}
