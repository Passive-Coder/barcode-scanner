<script>
  import { SHEET_ROW_LIMIT } from "$lib/config.js";
  import { attempt } from "$lib/feedback.js";
  import { deleteRow, editRow } from "$lib/sheet-actions.js";
  import { columnLetter } from "$lib/sheets/values.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  const id = $props.id();
  const columns = $derived(Array.from({ length: workspace.columnCount }, (_, index) => index));
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

<section aria-labelledby="{id}-title">
  <div class="heading">
    <div>
      <h3 id="{id}-title">Rows</h3>
      <p>Showing up to {SHEET_ROW_LIMIT.toLocaleString()} rows. Double-click a cell to edit it; edits are saved straight to Google Sheets.</p>
    </div>
    <Button {disabled} onclick={() => editRow(null)}>Add row</Button>
  </div>

  <div class="wrap">
    {#if columns.length}
      <table>
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
      {#if !dataRows.length}
        <p class="empty-note">No data rows yet. Scan a barcode or add a row.</p>
      {/if}
    {:else}
      <p class="empty-note">Column headings and rows will appear here.</p>
    {/if}
  </div>
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

  /* The table keeps a light paper look in both themes for legibility. */
  .wrap {
    --link: #892331;
    --danger: #a3222c;
    --focus-ring: #851c30;
    max-height: 500px;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--table-bg);
    color: var(--table-ink);
  }

  table {
    min-width: 100%;
    width: max-content;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    min-width: 130px;
    max-width: 300px;
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
    width: 52px;
    min-width: 52px;
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--table-muted);
  }

  .row-actions {
    min-width: 128px;
    white-space: nowrap;
  }

  .row-actions :global(.button + .button) {
    margin-left: 14px;
  }

  .empty-note {
    padding: 18px;
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
