<script>
  import { attempt } from "$lib/feedback.js";
  import { enter } from "$lib/motion.js";
  import { forgetLink } from "$lib/sheet-actions.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import SheetLinkForm from "../../components/sheets/SheetLinkForm.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import BackButton from "./BackButton.svelte";

  const scanning = $derived(mobileNav.intent === "scan");
  /** @type {string | null} */
  let opening = $state(null);

  /** @param {string} id */
  async function openSheet(id) {
    if (opening) return;
    opening = id;
    const opened = await attempt(async () => {
      await workspace.open(id);
      return true;
    }, "Could not open spreadsheet");
    opening = null;
    if (opened) mobileNav.go("workspace");
  }
</script>

<section class="choose" aria-labelledby="choose-title" {@attach enter({ y: 14, duration: 0.45 })}>
  <header>
    <BackButton label="Back to home" onclick={() => mobileNav.go("home")} />
    <h1 id="choose-title">{scanning ? "Scan into a sheet" : "Edit a sheet"}</h1>
  </header>

  <SessionBanner />

  {#if workspace.links.length}
    <h2>Your spreadsheets</h2>
    <ul class="list">
      {#each workspace.links as link (link.id)}
        <li class="row">
          <button class="item" type="button" disabled={Boolean(opening)} aria-busy={opening === link.id || undefined} onclick={() => openSheet(link.id)}>
            <span class="name">{link.title}</span>
            <span class="state" aria-hidden="true">{opening === link.id ? "Opening…" : ""}</span>
            <span class="chevron" aria-hidden="true"></span>
          </button>
          <button class="remove" type="button" aria-label="Forget {link.title}" onclick={() => forgetLink(link.id)}>×</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No spreadsheets yet. Add one with its Google Sheets link.</p>
  {/if}

  <div class="add">
    <SheetLinkForm label="Add a spreadsheet" submitLabel="Add spreadsheet" layout="stacked" onlinked={() => mobileNav.go("workspace")} />
  </div>
</section>

<style>
  .choose {
    max-width: 560px;
    min-height: 100svh;
    margin: auto;
    padding: calc(20px + var(--safe-top)) 20px calc(28px + var(--safe-bottom));
  }

  header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .choose > :global(.banner) {
    margin-bottom: 20px;
  }

  h2 {
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .list {
    display: grid;
    gap: 8px;
    margin: 0 0 28px;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .item {
    flex: 1;
    min-width: 0;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .item:hover {
    background: var(--surface-hover);
  }

  .item:disabled {
    cursor: progress;
    opacity: 0.75;
  }

  .name {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .state {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .chevron {
    width: 8px;
    height: 8px;
    flex: none;
    border-top: 2px solid var(--ink-muted);
    border-right: 2px solid var(--ink-muted);
    transform: rotate(45deg);
  }

  .remove {
    width: 48px;
    flex: none;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: transparent;
    color: var(--ink-muted);
    font-size: 22px;
  }

  .remove:hover {
    background: var(--surface-hover);
    color: var(--ink);
  }

  .empty {
    margin: 0 0 28px;
    padding: 20px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    font-size: 15px;
    color: var(--ink-muted);
  }
</style>
