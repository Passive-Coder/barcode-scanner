<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { changeLog } from "$lib/stores/changes.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  /**
   * Shows changes stored in Linework because Google Sheets couldn't take them, with Migrate
   * changes to write them into the spreadsheet once Google is reachable again.
   */
  const counts = $derived(changeLog.counts(workspace.activeId));
  /** Why automatic migration gave up on this spreadsheet, if it did. */
  const stuck = $derived(changeLog.blocked[workspace.activeId] ?? "");
  const visible = $derived(Boolean(workspace.activeId) && (counts.pending > 0 || counts.conflicts > 0));
  const blocker = $derived.by(() => {
    if (!counts.pending) return "Nothing is waiting to be migrated.";
    if (auth.status === "expired") return "Reconnect Google to migrate.";
    if (!auth.connected) return "Connect Google to migrate.";
    if (workspace.readOnly) return "This account needs Editor access to migrate.";
    if (!account.ready) return "Linework's server can't be reached yet.";
    return "";
  });

  async function migrate() {
    const id = workspace.activeId;
    const outcome = await attempt(() => changeLog.migrate(id), "Could not migrate changes");
    if (!outcome) return;
    const { applied, conflicts } = outcome;
    if (applied) toast.show(`${pluralize(applied, "change")} migrated to Google Sheets${conflicts ? `; ${pluralize(conflicts, "change")} need${conflicts === 1 ? "s" : ""} your attention` : ""}.`);
    else if (conflicts) toast.error(`${pluralize(conflicts, "change")} couldn't be placed safely. Review them to decide what to do.`);
    if (id === workspace.activeId) await attempt(() => workspace.refresh(), "Could not reload the spreadsheet");
    if (conflicts) changeLog.reviewOpen = true;
  }
</script>

{#if visible}
  <div class="pending" role="status">
    <div class="text">
      <strong>
        {#if counts.pending}
          {pluralize(counts.pending, "change")} stored in Linework
        {:else}
          {pluralize(counts.conflicts, "change")} need{counts.conflicts === 1 ? "s" : ""} your attention
        {/if}
      </strong>
      <p>
        {#if counts.pending}
          {#if changeLog.migrating}
            Adding {counts.pending === 1 ? "it" : "them"} to Google Sheets now…
          {:else}
            Google Sheets couldn't be reached when {counts.pending === 1 ? "it was" : "they were"} made. Linework adds {counts.pending === 1 ? "it" : "them"} to the right tab and
            columns automatically as soon as Google responds, without overwriting anything changed since.
          {/if}
          {#if counts.local}{pluralize(counts.local, "change")} {counts.local === 1 ? "is" : "are"} still in this browser and will upload first.{/if}
        {:else}
          These couldn't be placed without overwriting newer data. Review them to retry or discard.
        {/if}
        {#if counts.pending && counts.conflicts}{pluralize(counts.conflicts, "other change")} need{counts.conflicts === 1 ? "s" : ""} your attention.{/if}
      </p>
      {#if stuck && counts.pending}
        <p class="blocker">Couldn't add {counts.pending === 1 ? "it" : "them"} automatically: {stuck}</p>
      {:else if blocker && counts.pending}
        <p class="blocker">{blocker}</p>
      {/if}
    </div>
    <div class="actions">
      <Button variant="quiet" onclick={() => (changeLog.reviewOpen = true)}>Review</Button>
      <Button variant="primary" busy={changeLog.migrating} disabled={Boolean(blocker)} title={blocker || undefined} onclick={migrate}>
        {changeLog.migrating ? "Migrating…" : "Migrate changes"}
      </Button>
    </div>
  </div>
{/if}

<style>
  .pending {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 20px;
    margin-top: 20px;
    padding: 14px 16px;
    border: 1px solid var(--line-strong);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .text {
    flex: 1 1 320px;
    min-width: 0;
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
  }

  .blocker {
    margin-top: 6px;
    font-weight: 600;
    color: var(--ink);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 18px;
  }
</style>
