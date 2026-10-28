<script>
  import { addTab, deleteTab, renameTab } from "$lib/sheet-actions.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { changeLog } from "$lib/stores/changes.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  const disabled = $derived(!workspace.canEdit);
</script>

<div class="bar">
  <div class="title">
    <strong>{workspace.title || "Spreadsheet"}</strong>
    {#if workspace.tab}<span class="tab">{workspace.tab.title}</span>{/if}
    {#if workspace.activeId}
      <a class="open" href={workspace.metadata?.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${workspace.activeId}/edit`} target="_blank" rel="noopener noreferrer">
        Open in Google Sheets
      </a>
    {/if}
  </div>
  <div class="actions">
    <Button variant="quiet" disabled={!account.ready && !changeLog.local.length} title={account.ready ? undefined : "Needs Linework's server"} onclick={() => (changeLog.reviewOpen = true)}>Change log</Button>
    <Button variant="quiet" {disabled} onclick={addTab}>Add tab</Button>
    <Button variant="quiet" {disabled} onclick={renameTab}>Rename tab</Button>
    <Button variant="quiet" tone="danger" {disabled} onclick={deleteTab}>Delete tab</Button>
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 24px;
    padding: 14px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    min-width: 0;
  }

  strong {
    font-size: 18px;
    font-weight: 650;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .tab {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface-sunk);
    font-size: 13px;
    color: var(--ink-muted);
  }

  .open {
    font-size: 13px;
    font-weight: 600;
    color: var(--link);
  }

  .open:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  @media (max-width: 700px) {
    .bar {
      flex-direction: column;
      align-items: start;
    }
  }
</style>
