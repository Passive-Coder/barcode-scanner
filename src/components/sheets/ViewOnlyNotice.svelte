<script>
  import { attempt } from "$lib/feedback.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
</script>

{#if workspace.readOnly}
  <div class="notice" role="status">
    <div class="text">
      <strong>Sign in as the owner to make changes</strong>
      <p>
        {auth.email || "This Google account"} can only view this spreadsheet. Sign in with the Google account that owns it
        to add columns, edit rows, and record scans. You'll stay on this spreadsheet.
      </p>
    </div>
    <Button variant="primary" busy={auth.status === "connecting"} onclick={() => attempt(() => workspace.connect(), "Could not switch Google account")}>
      Sign in as the owner
    </Button>
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
