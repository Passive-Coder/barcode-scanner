<script>
  import { attempt } from "$lib/feedback.js";
  import { forgetLink } from "$lib/sheet-actions.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  const id = $props.id();
  const disabled = $derived(!auth.connected || workspace.loading);

  /** @param {string} spreadsheetId */
  function openSpreadsheet(spreadsheetId) {
    if (spreadsheetId) attempt(() => workspace.open(spreadsheetId), "Could not read spreadsheet");
  }

  /** @param {string} sheetId */
  function openTab(sheetId) {
    if (sheetId) attempt(() => workspace.selectTab(Number(sheetId)), "Could not read tab");
  }
</script>

<div class="picker">
  <label for="{id}-doc">
    <span class="field-label">Spreadsheet</span>
    <select id="{id}-doc" class="select" value={workspace.activeId} {disabled} onchange={(event) => openSpreadsheet(event.currentTarget.value)}>
      <option value="">Choose a spreadsheet</option>
      {#each workspace.links as link (link.id)}
        <option value={link.id}>{link.title}</option>
      {/each}
    </select>
  </label>
  <label for="{id}-tab">
    <span class="field-label">Tab</span>
    <select id="{id}-tab" class="select" value={workspace.sheetId === null ? "" : String(workspace.sheetId)} disabled={disabled || !workspace.tabs.length} onchange={(event) => openTab(event.currentTarget.value)}>
      <option value="">Choose a tab</option>
      {#each workspace.tabs as tab (tab.sheetId)}
        <option value={String(tab.sheetId)}>{tab.title}</option>
      {/each}
    </select>
  </label>
  <div class="buttons">
    <Button busy={workspace.loading} disabled={!workspace.activeId || !auth.connected} onclick={() => attempt(() => workspace.refresh(), "Could not refresh spreadsheet")}>
      Refresh
    </Button>
    <Button variant="quiet" disabled={!workspace.activeId} onclick={() => forgetLink(workspace.activeId)}>Forget link</Button>
  </div>
</div>
<p class={["status", workspace.status.error && "error"]} role="status">{workspace.statusText}</p>

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 12px;
    margin-top: 16px;
  }

  label {
    flex: 1;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .buttons {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status {
    min-height: 1.5em;
    margin: 12px 0 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .status.error {
    color: var(--danger);
  }

  @media (max-width: 700px) {
    .picker {
      flex-direction: column;
      align-items: stretch;
    }

    label {
      min-width: 0;
    }

    .buttons :global(.button.secondary) {
      flex: 1;
    }
  }
</style>
