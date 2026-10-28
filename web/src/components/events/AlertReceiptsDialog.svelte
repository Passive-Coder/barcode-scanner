<script>
  import { untrack } from "svelte";
  import { errorMessage, formatDateTime } from "$lib/format.js";
  import { events } from "$lib/stores/events.svelte.js";
  import Modal from "../ui/Modal.svelte";

  /**
   * Who an alert reached and who has acknowledged it. For its sender and the organizers.
   * @type {{ alert: import("$lib/stores/alerts.svelte.js").Alert, onclose: () => void }}
   */
  let { alert, onclose } = $props();

  let recipients = $state(/** @type {Array<{ email: string, name: string, acknowledgedAt: number | null }> | null} */ (null));
  let error = $state("");
  const waiting = $derived(recipients?.filter((recipient) => !recipient.acknowledgedAt) ?? []);
  const seen = $derived(recipients?.filter((recipient) => recipient.acknowledgedAt) ?? []);

  const id = untrack(() => alert.id);
  events
    .alertRecipients(id)
    .then((list) => (recipients = list))
    .catch((failure) => (error = errorMessage(failure)));
</script>

<Modal open {onclose} title="“{alert.title}”" size="compact">
  {#if error}
    <p class="error" role="alert">{error}</p>
  {:else if !recipients}
    <p class="empty-note">Loading…</p>
  {:else}
    <p class="summary">{seen.length} of {recipients.length} acknowledged</p>
    {#if waiting.length}
      <h3>Not yet</h3>
      <ul>
        {#each waiting as person (person.email)}<li><span>{person.name || person.email}</span></li>{/each}
      </ul>
    {/if}
    {#if seen.length}
      <h3>Acknowledged</h3>
      <ul>
        {#each seen as person (person.email)}
          <li><span>{person.name || person.email}</span><span class="time">{formatDateTime(new Date(/** @type {number} */ (person.acknowledgedAt)))}</span></li>
        {/each}
      </ul>
    {/if}
  {/if}
</Modal>

<style>
  .summary {
    margin: 8px 0 0;
    font-size: 15px;
    font-weight: 600;
  }

  h3 {
    margin: 18px 0 6px;
    font-size: 14px;
    color: var(--dialog-ink);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--dialog-line);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .time {
    flex: none;
    opacity: 0.75;
  }

  .error {
    margin: 12px 0 0;
    font-size: 14px;
    color: var(--danger);
  }
</style>
