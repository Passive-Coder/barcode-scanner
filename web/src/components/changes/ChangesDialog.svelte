<script>
  import { attempt } from "$lib/feedback.js";
  import { formatDateTime } from "$lib/format.js";
  import { changeLog } from "$lib/stores/changes.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
  import Modal from "../ui/Modal.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import ChangeRow from "./ChangeRow.svelte";

  // The open spreadsheet's change log for the signed-in person: changes waiting to be
  // migrated, those that need attention, and the history of everything recorded.
  const open = $derived(changeLog.reviewOpen);

  /** "waiting", "attention", or "history" */
  let view = $state("waiting");
  let loading = $state(false);

  const waiting = $derived([...changeLog.local.filter((change) => change.spreadsheetId === workspace.activeId), ...changeLog.open.filter((change) => change.status !== "conflict")]);
  const attention = $derived(changeLog.open.filter((change) => change.status === "conflict"));
  const list = $derived(view === "waiting" ? waiting : view === "attention" ? attention : changeLog.history);

  $effect(() => {
    if (!open || !workspace.activeId) return;
    const id = workspace.activeId;
    loading = true;
    attempt(() => changeLog.load(id), "Could not load the change log").finally(() => (loading = false));
  });

  // Open where the person most likely needs to look.
  $effect(() => {
    if (open) view = attention.length && !waiting.length ? "attention" : "waiting";
  });

  /** @param {string[]} ids */
  const discard = (ids) => attempt(() => changeLog.discard(workspace.activeId, ids), "Could not discard changes");
  /** @param {string[]} ids */
  const retry = (ids) => attempt(() => changeLog.retry(workspace.activeId, ids), "Could not retry changes");
</script>

<Modal {open} onclose={() => (changeLog.reviewOpen = false)} title="Change log" size="wide">
  <p class="intro">
    Changes you made to “{workspace.title || "this spreadsheet"}” through Linework. Only you can see this list.
    {#if changeLog.history[0]}Last change {formatDateTime(new Date(changeLog.history[0].createdAt))}.{/if}
  </p>

  <Tabs
    label="Change log"
    bind:value={view}
    options={[
      { value: "waiting", label: "Waiting", count: waiting.length },
      { value: "attention", label: "Needs attention", count: attention.length },
      { value: "history", label: "History" },
    ]}
  />

  <div class="list" aria-busy={loading || undefined}>
    {#if list.length}
      <ul>
        {#each list as change (change.id)}
          <ChangeRow {change}>
            {#snippet actions()}
              {#if change.status === "conflict"}
                <Button variant="quiet" onclick={() => retry([change.id])}>Try again</Button>
                <Button variant="quiet" tone="danger" onclick={() => discard([change.id])}>Discard</Button>
              {:else if change.status === "pending"}
                <Button variant="quiet" tone="danger" onclick={() => discard([change.id])}>Discard</Button>
              {/if}
            {/snippet}
          </ChangeRow>
        {/each}
      </ul>
    {:else}
      <p class="empty-note">
        {loading ? "Loading…" : view === "waiting" ? "Nothing is waiting to be migrated." : view === "attention" ? "Nothing needs your attention." : "No changes recorded yet."}
      </p>
    {/if}
  </div>

  {#if view === "attention" && attention.length > 1}
    <div class="bulk">
      <Button variant="quiet" onclick={() => retry(attention.map((change) => change.id))}>Try all again</Button>
      <Button variant="quiet" tone="danger" onclick={() => discard(attention.map((change) => change.id))}>Discard all</Button>
    </div>
  {/if}
</Modal>

<style>
  .intro {
    margin: 8px 0 16px;
    font-size: 14px;
    opacity: 0.85;
  }

  .list {
    max-height: min(55vh, 480px);
    margin-top: 12px;
    overflow: auto;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bulk {
    display: flex;
    justify-content: flex-end;
    gap: 18px;
    margin-top: 12px;
  }
</style>
