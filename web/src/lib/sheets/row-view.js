/**
 * What the rows view shows of a tab, kept fast for sheets with thousands of rows: a search
 * across every cell, newest-first order, a one-line summary per row, and the window of rows
 * actually drawn while the list scrolls.
 *
 * @typedef {{ cells: string[], rowNumber: number }} SheetRow rowNumber: 1-based, as in Google Sheets
 */

/**
 * The data rows (headings excluded) that match `query` in any cell, ignoring case.
 * @param {string[][]} rows every row of the tab, headings first
 * @param {{ query?: string, newestFirst?: boolean }} [options]
 * @returns {SheetRow[]}
 */
export function visibleRows(rows, { query = "", newestFirst = false } = {}) {
  const term = query.trim().toLowerCase();
  /** @type {SheetRow[]} */
  const shown = [];
  for (let index = 1; index < rows.length; index++) {
    const cells = rows[index] ?? [];
    if (term && !cells.some((cell) => String(cell ?? "").toLowerCase().includes(term))) continue;
    shown.push({ cells, rowNumber: index + 1 });
  }
  return newestFirst ? shown.reverse() : shown;
}

/**
 * A row in a line or two: its first value as the title, then the next few as "Heading: value".
 * @param {string[]} cells @param {string[]} headers @param {number} [limit] values in the detail
 */
export function rowSummary(cells, headers, limit = 3) {
  const filled = cells.flatMap((value, column) => (String(value ?? "").trim() ? [{ value: String(value), header: headers[column] ?? "" }] : []));
  if (!filled.length) return { title: "Empty row", detail: "" };
  const [first, ...rest] = filled;
  return {
    title: first.value,
    detail: rest
      .slice(0, limit)
      .map(({ header, value }) => (header ? `${header}: ${value}` : value))
      .join(" · "),
  };
}

/**
 * The items to draw in a scrolling list of fixed-height items: those in view plus `overscan`
 * either side, with the space to leave above and below them.
 * @param {{ scrollTop: number, viewport: number, itemHeight: number, count: number, overscan?: number }} options
 * @returns {{ start: number, end: number, before: number, after: number }} end is exclusive; before and after in px
 */
export function windowRange({ scrollTop, viewport, itemHeight, count, overscan = 8 }) {
  const first = Math.floor(Math.max(0, scrollTop) / itemHeight);
  const visible = Math.ceil(Math.max(viewport, itemHeight) / itemHeight);
  const start = Math.max(0, Math.min(count, first - overscan));
  const end = Math.max(start, Math.min(count, first + visible + overscan));
  return { start, end, before: start * itemHeight, after: (count - end) * itemHeight };
}
