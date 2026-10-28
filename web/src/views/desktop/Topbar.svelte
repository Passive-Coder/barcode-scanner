<script>
  import { attempt } from "$lib/feedback.js";
  import { alerts } from "$lib/stores/alerts.svelte.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { desktopNav } from "$lib/stores/layout.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import BrandMark from "../../components/brand/BrandMark.svelte";
  import Button from "../../components/ui/Button.svelte";

  const SECTIONS = /** @type {const} */ ([
    { id: "scanner", label: "Scanner" },
    { id: "events", label: "Events" },
    { id: "teams", label: "Teams" },
  ]);

  function signOut() {
    workspace.signOut();
    desktopNav.go("scanner");
    toast.show("Signed out of Google");
  }
</script>

<header class="topbar">
  <a class="brand" href="./" aria-label="stucovitv.in Linework home">
    <BrandMark />
    <span class="brand-copy"><strong>stucovitv.in</strong><small>Linework barcode scanner</small></span>
  </a>
  <nav class="sections" aria-label="Sections">
    {#each SECTIONS as section (section.id)}
      <button type="button" class={{ current: desktopNav.section === section.id }} aria-current={desktopNav.section === section.id ? "page" : undefined} onclick={() => desktopNav.go(section.id)}>
        {section.label}
      </button>
    {/each}
  </nav>
  <div class="right">
    {#if auth.connected || auth.status === "expired"}
      <button type="button" class="alerts" aria-label={alerts.unread ? `Alerts, ${alerts.unread} new` : "Alerts"} onclick={() => (alerts.inboxOpen = true)}>
        Alerts
        {#if alerts.unread}<span class="badge">{alerts.unread > 99 ? "99+" : alerts.unread}</span>{/if}
      </button>
    {/if}
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

  .sections {
    display: flex;
    align-self: stretch;
    gap: 4px;
    margin-right: auto;
    margin-left: 28px;
  }

  .sections button,
  .alerts {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .sections button:hover,
  .alerts:hover {
    color: var(--ink-strong);
  }

  .sections .current {
    border-bottom-color: var(--accent);
    color: var(--ink-strong);
  }

  .alerts {
    min-height: 36px;
    border: 1px solid var(--secondary-border);
    border-radius: var(--radius-sm);
  }

  .badge {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--danger);
    color: var(--on-danger);
    font-size: 12px;
    line-height: 20px;
    text-align: center;
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

  @media (max-width: 1100px) {
    .account {
      display: none;
    }
  }

  @media (max-width: 860px) {
    .brand-copy small {
      display: none;
    }

    .sections {
      margin-left: 12px;
    }
  }
</style>
