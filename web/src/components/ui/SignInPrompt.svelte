<script>
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "./Button.svelte";

  /**
   * Stands in for a page that needs a Linework session: asks to sign in, waits for the
   * session, or explains that the server can't be reached.
   * @type {{ what: string }}
   */
  let { what } = $props();
</script>

<div class="prompt" role="status">
  {#if !auth.connected && auth.status !== "expired"}
    <strong>Sign in to see {what}</strong>
    <p>Events, teams, and alerts are tied to your Google account.</p>
    <Button variant="primary" busy={auth.status === "connecting"} onclick={() => attempt(() => workspace.connect(), "Google sign-in failed")}>Sign in with Google</Button>
  {:else if account.status === "connecting"}
    <strong>Connecting to Linework…</strong>
  {:else if account.status === "unavailable"}
    <strong>Linework's server can't be reached</strong>
    <p>{account.problem || "Check your connection."} Scanning and Google Sheets still work.</p>
    <Button disabled={!auth.connected} onclick={() => account.start()}>Try again</Button>
  {:else}
    <strong>Reconnect Google to see {what}</strong>
    <p>Your Google session expired.</p>
    <Button variant="primary" busy={auth.status === "connecting"} onclick={() => attempt(() => workspace.connect(), "Google reconnect failed")}>Reconnect</Button>
  {/if}
</div>

<style>
  .prompt {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 8px;
    padding: 24px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
  }

  strong {
    font-size: 17px;
    font-weight: 650;
    color: var(--ink-strong);
  }

  p {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--ink-muted);
  }
</style>
