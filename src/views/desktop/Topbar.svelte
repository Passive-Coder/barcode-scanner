<script>
  import { attempt } from "$lib/feedback.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import BrandMark from "../../components/brand/BrandMark.svelte";
  import Button from "../../components/ui/Button.svelte";

  function signOut() {
    workspace.signOut();
    toast.show("Signed out of Google");
  }
</script>

<header class="topbar">
  <a class="brand" href="./" aria-label="stucovitv.in Linework home">
    <BrandMark />
    <span class="brand-copy"><strong>stucovitv.in</strong><small>Linework barcode scanner</small></span>
  </a>
  <div class="right">
    {#if auth.connected && auth.email}
      <span class="account">{auth.email}</span>
    {/if}
    {#if auth.connected}
      <Button variant="outline" onclick={signOut}>Sign out</Button>
    {:else}
      <Button variant="outline" busy={auth.status === "connecting"} onclick={() => attempt(() => workspace.connect(), "Google sign-in failed")}>
        {auth.status === "expired" ? "Reconnect Google" : "Sign in with Google"}
      </Button>
    {/if}
    <Button variant="icon" aria-label="Settings" title="Settings" onclick={() => (dialogs.settingsOpen = true)}>⚙</Button>
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 var(--gutter);
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--ink-strong);
  }

  .brand :global(.mark) {
    transform: scale(0.8);
    color: var(--accent);
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .brand-copy strong {
    font: inherit;
  }

  .brand-copy small {
    margin-top: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .account {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: var(--ink-muted);
  }

  @media (max-width: 900px) {
    .account {
      display: none;
    }
  }
</style>
