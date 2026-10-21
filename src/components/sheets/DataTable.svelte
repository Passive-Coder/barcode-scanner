<script>
  import { SHEET_ROW_LIMIT } from "$lib/config.js";
  import { attempt } from "$lib/feedback.js";
  import { deleteRow, editRow } from "$lib/sheet-actions.js";
  import { columnLetter } from "$lib/sheets/values.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  /** Narrowest readable column in the table. Below it, rows are shown as cards instead. */
  const MIN_COLUMN_WIDTH = 120;
  /** The row number and Edit/Delete columns. */
  const FIXED_WIDTH = 52 + 136;

  const id = $props.id();
  const columns = $derived(Array.from({ length: workspace.columnCount }, (_, index) => index));
  let width = $state(0);
  /** Cards on phones and for wide sheets, so the page never scrolls sideways. */
  const cards = $derived(width > 0 && width < columns.length * MIN_COLUMN_WIDTH + FIXED_WIDTH);
  /** Data rows with their 1-based sheet row numbers (row 1 holds the headings). */
  const dataRows = $derived(workspace.rows.slice(1).map((cells, index) => ({ cells, rowNumber: index + 2 })));
  const disabled = $derived(!workspace.canEdit);

  /** The cell being edited in place, as in Google Sheets. @type {{ row: number, column: number, value: string, original: string } | null} */
  let editing = $state(null);
  /** A cell edit on its way to Google, shown until the rows reload. @type {{ row: number, column: number, value: string } | null} */
  let saving = $state(null);

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
</script>

<section aria-labelledby="{id}-title" bind:clientWidth={width}>
  <div class="heading">
    <div>
      <h3 id="{id}-title">Rows <span class="count">{dataRows.length.toLocaleString()}</span></h3>
      <p>
        {cards ? "Tap Edit on a row to change it." : "Double-click a cell to edit it."} Changes are saved straight to Google Sheets.
        {#if dataRows.length >= SHEET_ROW_LIMIT - 1}Only the first {SHEET_ROW_LIMIT.toLocaleString()} rows are shown.{/if}
      </p>
    </div>
    <Button {disabled} onclick={() => editRow(null)}>Add row</Button>
  </div>

  {#if !columns.length}
    <p class="empty">This tab has no columns yet. Add a column above, then add rows or scan barcodes into it.</p>
  {:else if !dataRows.length}
    <p class="empty">No rows yet. Scan a barcode or add a row.</p>
  {:else if cards}
    <ol class="cards">
      {#each dataRows as row (row.rowNumber)}
        <li class="card">
          <div class="card-head">
            <span class="row-number">Row {row.rowNumber}</span>
            <span class="row-actions">
              <Button variant="quiet" {disabled} aria-label="Edit row {row.rowNumber}" onclick={() => editRow(row.rowNumber)}>Edit</Button>
              <Button variant="quiet" tone="danger" {disabled} aria-label="Delete row {row.rowNumber}" onclick={() => deleteRow(row.rowNumber)}>Delete</Button>
            </span>
          </div>
          <dl>
            {#each columns as column (column)}
              <div class="pair">
                <dt>{workspace.headers[column] || `Column ${columnLetter(column)}`}</dt>
                <dd class={{ blank: !row.cells[column] }}>{row.cells[column] || "—"}</dd>
              </div>
            {/each}
          </dl>
        </li>
      {/each}
    </ol>
  {:else}
    <div class="wrap">
      <table>
        <colgroup>
          <col class="number-col" />
          {#each columns as column (column)}<col />{/each}
          <col class="actions-col" />
        </colgroup>
        <thead>
          <tr>
            <th class="number" scope="col">#</th>
            {#each columns as column (column)}
              <th scope="col">{workspace.headers[column] || columnLetter(column)}</th>
            {/each}
            <th class="row-actions" scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each dataRows as row (row.rowNumber)}
            <tr>
              <th class="number" scope="row">{row.rowNumber}</th>
              {#each columns as column (column)}
                {#if editing?.row === row.rowNumber && editing.column === column}
                  <td class="editing">
                    <input
                      class="cell-input"
                      aria-label="{workspace.headers[column] || columnLetter(column)}, row {row.rowNumber}"
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
                  <td class={{ editable: !disabled }} ondblclick={() => startEdit(row.rowNumber, column)}>{row.cells[column] || "—"}</td>
                {/if}
              {/each}
              <td class="row-actions">
                <Button variant="quiet" {disabled} aria-label="Edit row {row.rowNumber}" onclick={() => editRow(row.rowNumber)}>Edit</Button>
                <Button variant="quiet" tone="danger" {disabled} aria-label="Delete row {row.rowNumber}" onclick={() => deleteRow(row.rowNumber)}>Delete</Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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

  .empty {
    margin: 0;
    padding: 20px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    font-size: 14px;
    color: var(--ink-muted);
  }

  /* Rows keep a light paper look in both themes for legibility. */
  .wrap,
  .card {
    --link: #892331;
    --danger: #a3222c;
    --focus-ring: #851c30;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--table-bg);
    color: var(--table-ink);
  }

  .wrap {
    max-height: min(70vh, 640px);
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* Columns share the width and long values wrap, so the table never runs off the side. */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 14px;
  }

  .number-col {
    width: 52px;
  }

  .actions-col {
    width: 136px;
  }

  th,
  td {
    padding: 10px 14px;
    border-right: 1px solid var(--table-line);
    border-bottom: 1px solid var(--table-line);
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--table-head);
    font-size: 13px;
    font-weight: 600;
  }

  tbody tr:hover td,
  tbody tr:hover th {
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
    min-height: 41px;
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
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--table-muted);
  }

  .row-actions {
    white-space: nowrap;
  }

  .row-actions :global(.button + .button) {
    margin-left: 14px;
  }

  /* One card per line on phones; side by side when a wide sheet is shown as cards on a big screen. */
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    align-items: start;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    padding: 4px 14px 10px;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--table-line);
  }

  .row-number {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--table-muted);
  }

  dl {
    margin: 0;
  }

  .pair {
    display: grid;
    grid-template-columns: minmax(84px, 36%) minmax(0, 1fr);
    gap: 12px;
    padding: 7px 0;
    font-size: 14px;
  }

  .pair + .pair {
    border-top: 1px solid var(--table-line);
  }

  dt {
    font-size: 13px;
    font-weight: 600;
    color: var(--table-muted);
    overflow-wrap: anywhere;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  dd.blank {
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
