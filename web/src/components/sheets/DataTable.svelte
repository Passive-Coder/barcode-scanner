<script>
  import { SHEET_ROW_LIMIT } from "$lib/config.js";
  import { attempt } from "$lib/feedback.js";
  import { deleteRow, editRow, viewRow } from "$lib/sheet-actions.js";
  import { rowSummary, visibleRows, windowRange } from "$lib/sheets/row-view.js";
  import { columnLetter } from "$lib/sheets/values.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  /** Narrowest readable column in the table. Below it, rows are shown as a list instead. */
  const MIN_COLUMN_WIDTH = 120;
  /** The row number and Edit/Delete columns. */
  const FIXED_WIDTH = 64 + 136;
  /** Rows have a fixed height so only those on screen are drawn, however long the sheet (table rows include their 1px border). */
  const TABLE_ROW_HEIGHT = 42;
  const LIST_ROW_HEIGHT = 64;

  const id = $props.id();
  const columns = $derived(Array.from({ length: workspace.columnCount }, (_, index) => index));
  let width = $state(0);
  /** A one-line list on phones and for wide sheets, so the page never scrolls sideways. */
  const list = $derived(width > 0 && width < columns.length * MIN_COLUMN_WIDTH + FIXED_WIDTH);
  const disabled = $derived(!workspace.canEdit);
  const dataCount = $derived(Math.max(0, workspace.rows.length - 1));

  let query = $state("");
  let newestFirst = $state(false);
  /** Data rows matching the search, with their 1-based sheet row numbers (row 1 holds the headings). */
  const shown = $derived(visibleRows(workspace.rows, { query, newestFirst }));

  /** @type {HTMLElement | undefined} */
  let scroller = $state();
  let scrollTop = $state(0);
  let viewport = $state(0);
  const range = $derived(windowRange({ scrollTop, viewport, itemHeight: list ? LIST_ROW_HEIGHT : TABLE_ROW_HEIGHT, count: shown.length }));
  const slice = $derived(shown.slice(range.start, range.end));

  /** A new search or order starts from the top of the list. */
  function toTop() {
    if (scroller) scroller.scrollTop = 0;
    scrollTop = 0;
  }

  /** The cell being edited in place, as in Google Sheets. @type {{ row: number, column: number, value: string, original: string } | null} */
  let editing = $state(null);
  /** A cell edit on its way to Google, shown until the rows reload. @type {{ row: number, column: number, value: string } | null} */
  let saving = $state(null);

  // Live updates wait while a cell is being edited or saved, so rows can't move under it.
  $effect(() => {
    if (editing || saving) return workspace.pauseLive();
  });

  /** @param {number} row @param {number} column */
  function startEdit(row, column) {
    if (disabled || saving) return;
    const original = workspace.rows[row - 1]?.[column] ?? "";
    editing = { row, column, value: original, original };
  }

  async function commit() {
    const cell = editing;
    editing = null;
    if (!cell || cell.value === cell.original) return;
    saving = { row: cell.row, column: cell.column, value: cell.value };
    await attempt(() => workspace.saveCell(cell.row, cell.column, cell.value), "Could not save the cell");
    saving = null;
  }

  /** @param {KeyboardEvent} event */
  function onkeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      editing = null;
    }
  }

  /** @type {import("svelte/attachments").Attachment<HTMLInputElement>} */
  const focusInput = (input) => {
    input.focus();
    input.select();
  };

  /** @param {number} column */
  const heading = (column) => workspace.headers[column] || columnLetter(column);
</script>

<section aria-labelledby="{id}-title" bind:clientWidth={width}>
  <div class="heading">
    <div>
      <h3 id="{id}-title">
        Rows <span class="count">{dataCount.toLocaleString()}</span>
        {#if auth.connected && workspace.syncedAt}
          <span class="live" title="Changes made in Google Sheets, or by other people, appear here within seconds.">Live</span>
        {/if}
      </h3>
      <p>
        {list ? "Select a row to see or change all of it." : "Double-click a cell to edit it."} Changes are saved straight to Google Sheets.
        {#if dataCount >= SHEET_ROW_LIMIT - 1}Only the first {SHEET_ROW_LIMIT.toLocaleString()} rows are shown.{/if}
      </p>
    </div>
    <Button {disabled} onclick={() => editRow(null)}>Add row</Button>
  </div>

  {#if !columns.length}
    <p class="empty">This tab has no columns yet. Add a column above, then add rows or scan barcodes into it.</p>
  {:else if !dataCount}
    <p class="empty">No rows yet. Scan a barcode or add a row.</p>
  {:else}
    <div class="tools">
      <input
        class="input search"
        type="search"
        placeholder="Search rows"
        aria-label="Search rows"
        aria-describedby="{id}-found"
        bind:value={query}
        oninput={toTop}
      />
      <select class="select order" aria-label="Order" bind:value={newestFirst} onchange={toTop}>
        <option value={false}>Sheet order</option>
        <option value={true}>Newest first</option>
      </select>
    </div>
    <p class="found" id="{id}-found" aria-live="polite">
      {#if query.trim()}{shown.length.toLocaleString()} of {dataCount.toLocaleString()} rows match{/if}
    </p>

    {#if !shown.length}
      <p class="empty">No rows match “{query.trim()}”.</p>
    {:else if list}
      <div class="scroll paper" bind:this={scroller} bind:clientHeight={viewport} onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}>
        <ol class="list" aria-label="Rows" style:padding-top="{range.before}px" style:padding-bottom="{range.after}px">
          {#each slice as row (row.rowNumber)}
            {@const summary = rowSummary(row.cells, workspace.headers)}
            <li class="item" style:height="{LIST_ROW_HEIGHT}px">
              <button type="button" class="summary" onclick={() => (disabled ? viewRow(row.rowNumber) : editRow(row.rowNumber))}>
                <span class="row-number">{row.rowNumber}</span>
                <span class="text">
                  <strong>{summary.title}</strong>
                  {#if summary.detail}<span>{summary.detail}</span>{/if}
                </span>
                <span class="visually-hidden">{disabled ? "View" : "Edit"} row {row.rowNumber}</span>
              </button>
              <Button variant="quiet" tone="danger" {disabled} aria-label="Delete row {row.rowNumber}" onclick={() => deleteRow(row.rowNumber)}>Delete</Button>
            </li>
          {/each}
        </ol>
      </div>
    {:else}
      <div class="scroll wrap paper" bind:this={scroller} bind:clientHeight={viewport} onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}>
        <table aria-rowcount={shown.length + 1}>
          <colgroup>
            <col class="number-col" />
            {#each columns as column (column)}<col />{/each}
            <col class="actions-col" />
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              <th class="number" scope="col">#</th>
              {#each columns as column (column)}
                <th scope="col" title={heading(column)}>{heading(column)}</th>
              {/each}
              <th class="row-actions" scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#if range.before}<tr class="spacer" aria-hidden="true" style:height="{range.before}px"><td colspan={columns.length + 2}></td></tr>{/if}
            {#each slice as row, index (row.rowNumber)}
              <tr aria-rowindex={range.start + index + 2} style:height="{TABLE_ROW_HEIGHT}px">
                <th class="number" scope="row">{row.rowNumber}</th>
                {#each columns as column (column)}
                  {#if editing?.row === row.rowNumber && editing.column === column}
                    <td class="editing">
                      <input
                        class="cell-input"
                        aria-label="{heading(column)}, row {row.rowNumber}"
                        bind:value={editing.value}
                        onblur={commit}
                        {onkeydown}
                        {@attach focusInput}
                      />
                    </td>
                  {:else if saving?.row === row.rowNumber && saving.column === column}
                    <td class="saving" aria-busy="true">{saving.value || "—"}</td>
                  {:else}
                    <!-- Mouse shortcut only: each row's Edit button offers the same edit by keyboard. -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <td class={{ editable: !disabled }} title={row.cells[column] || undefined} ondblclick={() => startEdit(row.rowNumber, column)}>{row.cells[column] || "—"}</td>
                  {/if}
                {/each}
                <td class="row-actions">
                  <Button variant="quiet" aria-label="{disabled ? 'View' : 'Edit'} row {row.rowNumber}" onclick={() => (disabled ? viewRow(row.rowNumber) : editRow(row.rowNumber))}>{disabled ? "View" : "Edit"}</Button>
                  <Button variant="quiet" tone="danger" {disabled} aria-label="Delete row {row.rowNumber}" onclick={() => deleteRow(row.rowNumber)}>Delete</Button>
                </td>
              </tr>
            {/each}
            {#if range.after}<tr class="spacer" aria-hidden="true" style:height="{range.after}px"><td colspan={columns.length + 2}></td></tr>{/if}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</section>

<style>
  .heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin: 32px 0 12px;
  }

  h3 {
    margin: 0 0 2px;
    font-size: 17px;
  }

  .heading p {
    margin: 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .count {
    margin-left: 4px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .live {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-muted);
    vertical-align: 2px;
  }

  .live::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
  }

  .empty {
    margin: 0;
    padding: 20px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    font-size: 14px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .tools {
    display: flex;
    gap: 10px;
  }

  .search {
    flex: 1;
    min-width: 0;
  }

  .order {
    width: auto;
    flex: none;
  }

  .found {
    min-height: 20px;
    margin: 6px 0 4px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  /* Rows keep a light paper look in both themes for legibility. */
  .paper {
    --link: #892331;
    --danger: #a3222c;
    --focus-ring: #851c30;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--table-bg);
    color: var(--table-ink);
  }

  /* Only the rows in view are drawn; the rest is space this box scrolls through. */
  .scroll {
    max-height: min(70vh, 640px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Columns share the width and long values are cut short, so the table never runs off the side. */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 14px;
  }

  /* Room for row numbers up to five digits. */
  .number-col {
    width: 64px;
  }

  .actions-col {
    width: 136px;
  }

  th,
  td {
    box-sizing: border-box;
    padding: 10px 14px;
    line-height: 20px;
    border-right: 1px solid var(--table-line);
    border-bottom: 1px solid var(--table-line);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--table-head);
    font-size: 13px;
    font-weight: 600;
  }

  .spacer td {
    padding: 0;
    border: 0;
  }

  tbody tr:not(.spacer):hover td,
  tbody tr:not(.spacer):hover th {
    background: var(--table-hover);
  }

  td.editable {
    cursor: cell;
  }

  td.editing {
    padding: 0;
    background: var(--table-bg);
    box-shadow: inset 0 0 0 2px var(--focus-ring);
  }

  .cell-input {
    width: 100%;
    height: 40px;
    padding: 10px 14px;
    border: 0;
    background: transparent;
    color: var(--table-ink);
    font: inherit;
    outline: none;
  }

  td.saving {
    color: var(--table-muted);
    font-style: italic;
  }

  .number {
    padding-right: 10px;
    padding-left: 10px;
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--table-muted);
  }

  /* Short padding so the buttons fit the row's fixed height. */
  td.row-actions {
    padding-top: 0;
    padding-bottom: 0;
    overflow: visible;
  }

  .row-actions :global(.button + .button) {
    margin-left: 14px;
  }

  .list {
    margin: 0;
    padding: 0 12px;
    list-style: none;
  }

  .item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--table-line);
  }

  .summary {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .row-number {
    min-width: 34px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--table-muted);
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .text strong,
  .text span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text strong {
    font-size: 15px;
    font-weight: 600;
  }

  .text span {
    font-size: 13px;
    color: var(--table-muted);
  }

  @media (max-width: 700px) {
    .heading {
      flex-direction: column;
      align-items: stretch;
      gap: 13px;
      margin-top: 28px;
    }
  }
</style>
