<script>
  import { attempt } from "$lib/feedback.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "./Button.svelte";

  const show = $derived(auth.status === "expired" || (auth.status === "connecting" && Boolean(auth.email)));
</script>

{#if show}
  <div class="banner" role="status">
    <span>Your Google session expired. Reconnect to keep reading and recording to Sheets.</span>
    <Button variant="primary" busy={auth.status === "connecting"} onclick={() => attempt(() => workspace.connect(), "Google reconnect failed")}>
      Reconnect
    </Button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 12px 12px 16px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-sunk);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.45;
  }

  @media (max-width: 520px) {
    .banner {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
