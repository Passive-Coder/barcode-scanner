<script>
  import { pluralize } from "$lib/format.js";
  import { addColumn } from "$lib/sheet-actions.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { session } from "$lib/stores/session.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
  import MappingRow from "./MappingRow.svelte";

  const id = $props.id();
  const summary = $derived(
    `${workspace.mappedCount} of ${pluralize(workspace.columnCount, "column")} mapped · ` +
      (session.availableFields.length ? `${pluralize(session.availableFields.length, "field")} available from this session` : "scan a barcode to reveal its fields"),
  );
</script>

<section class="mapping" aria-labelledby="{id}-title">
  <div class="heading">
    <div>
      <h3 id="{id}-title">Column mapping</h3>
      <p>Pick the barcode field each column should receive. Every scan adds one row with its mapped values.</p>
    </div>
    <label class="toggle">
      <input type="checkbox" checked={workspace.autoSave} onchange={(event) => workspace.setAutoSave(event.currentTarget.checked)} />
      <span>Record scans automatically</span>
    </label>
  </div>

  {#if workspace.columnCount}
    <div class="rows">
      {#each { length: workspace.columnCount }, column (column)}
        <MappingRow {column} />
      {/each}
    </div>
  {:else}
    <p class="empty-note rows">No columns yet. Add a column heading to set up this tab.</p>
  {/if}

  <div class="footer">
    <Button disabled={!auth.connected || workspace.loading} onclick={addColumn}>Add column</Button>
    <span>{summary}</span>
  </div>
</section>

<style>
  .heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin: 24px 0 12px;
  }

  h3 {
    margin: 0 0 2px;
    font-size: 17px;
  }

  p:not(.empty-note) {
    max-width: 560px;
    margin: 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-strong);
    white-space: nowrap;
    cursor: pointer;
  }

  .toggle input {
    width: 17px;
    height: 17px;
    accent-color: var(--accent);
  }

  .rows {
    border-top: 1px solid var(--line);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 16px;
  }

  .footer span {
    font-size: 13px;
    color: var(--ink-muted);
  }

  @media (max-width: 700px) {
    .heading {
      flex-direction: column;
      align-items: stretch;
      gap: 13px;
    }

    .footer {
      flex-direction: column;
      align-items: start;
      gap: 9px;
    }
  }
</style>
