<script>
  import { deleteColumn, renameColumn } from "$lib/sheet-actions.js";
  import { columnLetter } from "$lib/sheets/values.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { session } from "$lib/stores/session.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  /** @type {{ column: number }} */
  let { column } = $props();

  const letter = $derived(columnLetter(column));
  const heading = $derived(workspace.headers[column] ?? "");
  const stored = $derived(workspace.mapping[column] ?? "");
  /** Keep a saved mapping selectable even when no scan this session has that field. */
  const choices = $derived(
    stored && !session.availableFields.some((field) => field.key === stored)
      ? [...session.availableFields, { key: stored, label: stored, type: "Saved" }]
      : session.availableFields,
  );
  const disabled = $derived(!auth.connected || workspace.loading);
</script>

<div class="row">
  <div class="column">
    <span class="letter">{letter}</span>
    <strong class={[!heading && "untitled"]}>{heading || "Untitled column"}</strong>
  </div>
  <select
    class="select"
    aria-label="Barcode field for column {letter}"
    value={stored}
    onchange={(event) => workspace.setMapping(column, event.currentTarget.value)}
  >
    <option value="">Do not fill from scans</option>
    {#each choices as field (field.key)}
      <option value={field.key}>{field.label} · {field.type}</option>
    {/each}
  </select>
  <div class="actions">
    <Button variant="quiet" {disabled} aria-label="Rename column {letter}" onclick={() => renameColumn(column)}>Rename</Button>
    <Button variant="quiet" tone="danger" {disabled} aria-label="Delete column {letter}" onclick={() => deleteColumn(column)}>Delete</Button>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(160px, 0.8fr) minmax(210px, 1.2fr) auto;
    align-items: center;
    gap: 13px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }

  .column {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .letter {
    width: 31px;
    height: 31px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--surface-sunk);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-strong);
  }

  strong {
    font-size: 14px;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .untitled {
    font-weight: 500;
    font-style: italic;
    color: var(--ink-muted);
  }

  .select {
    min-height: 40px;
    font-size: 14px;
  }

  .actions {
    display: flex;
    gap: 14px;
  }

  @media (max-width: 700px) {
    .row {
      grid-template-columns: 1fr auto;
    }

    .select {
      grid-column: 1 / -1;
      grid-row: 2;
    }

    .actions {
      grid-column: 2;
      grid-row: 1;
    }
  }
</style>
