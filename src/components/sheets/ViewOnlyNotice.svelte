<script>
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
</script>

{#if workspace.readOnly}
  <div class="notice" role="status">
    <div class="text">
      <strong>Editor access is needed to make changes</strong>
      <p>
        {auth.email || "This Google account"} can view this spreadsheet, but Google has not granted it edit access.
        Ask the spreadsheet owner to share it with you as an Editor to add columns, edit rows, and record scans.
      </p>
    </div>
  </div>
{/if}

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 20px;
    margin-top: 20px;
    padding: 14px 16px;
    border: 1px solid var(--line-strong);
    border-left: 4px solid #c98a1c;
    border-radius: var(--radius);
    background: var(--surface);
  }

  .text {
    flex: 1 1 320px;
  }

  strong {
    font-size: 15px;
    font-weight: 650;
    color: var(--ink-strong);
  }

  p {
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }
</style>
