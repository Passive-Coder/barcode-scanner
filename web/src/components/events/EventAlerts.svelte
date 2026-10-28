<script>
  import { attempt } from "$lib/feedback.js";
  import { timeAgo } from "$lib/format.js";
  import { alerts } from "$lib/stores/alerts.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";
  import AlertComposer from "./AlertComposer.svelte";
  import AlertReceiptsDialog from "./AlertReceiptsDialog.svelte";

  /** @typedef {import("$lib/stores/alerts.svelte.js").Alert} Alert */

  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  /** @type {Alert | null} */
  let receipts = $state(null);
  let refreshing = $state(false);

  /** Acknowledgements for alerts sent to this person live in the inbox. */
  const myAcks = $derived(new Map(alerts.inbox.map((alert) => [alert.id, alert.acknowledgedAt])));

  async function refresh() {
    refreshing = true;
    await attempt(() => events.loadAlerts(), "Could not load alerts");
    refreshing = false;
  }
</script>

{#if detail && me}
  {#if me.canSendAlerts}
    <AlertComposer />
  {:else}
    <p class="intro">Organizers and sub-team managers send alerts here. Alerts sent to you appear on screen and in your alerts list.</p>
  {/if}

  <div class="history-head">
    <h3>{me.role === "organizer" ? "Alerts in this event" : "Your alerts in this event"}</h3>
    <Button variant="quiet" busy={refreshing} onclick={refresh}>Refresh</Button>
  </div>

  {#if events.alerts.length}
    <ul class="history">
      {#each events.alerts as alert (alert.id)}
        {@const mine = alert.senderEmail === me.email}
        <li class={["alert", alert.urgency]}>
          <div class="top">
            <strong>{alert.title}</strong>
            <Pill tone={alert.urgency === "page" ? "danger" : "default"}>{alert.urgency === "page" ? "Page" : "Notice"}</Pill>
          </div>
          {#if alert.body}<p class="body">{alert.body}</p>{/if}
          <p class="meta">
            {mine ? "You" : alert.senderName || alert.senderEmail} → {alert.audienceLabel} · {timeAgo(alert.createdAt)}
          </p>
          <div class="foot">
            {#if alert.recipientCount !== undefined && (mine || me.role === "organizer")}
              <span class="acks">{alert.acknowledgedCount} of {alert.recipientCount} acknowledged</span>
              <Button variant="quiet" onclick={() => (receipts = alert)}>Who's seen it</Button>
            {/if}
            {#if myAcks.has(alert.id)}
              {#if myAcks.get(alert.id)}
                <span class="acks">You acknowledged</span>
              {:else}
                <Button variant="quiet" onclick={() => alerts.acknowledge(alert.id)}>Acknowledge</Button>
              {/if}
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-note">No alerts yet.</p>
  {/if}

  {#if receipts}
    <AlertReceiptsDialog alert={receipts} onclose={() => (receipts = null)} />
  {/if}
{/if}

<style>
  .intro {
    margin: 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .history-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 26px 0 10px;
  }

  h3 {
    font-size: 17px;
  }

  .history {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .alert {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-left-width: 4px;
    border-radius: var(--radius);
    background: var(--surface);
  }

  .alert.page {
    border-left-color: var(--danger);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  strong {
    font-size: 15px;
    font-weight: 650;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .body {
    margin: 4px 0 0;
    font-size: 14px;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .meta {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
  }

  .foot:empty {
    display: none;
  }

  .acks {
    font-size: 13px;
    font-weight: 600;
  }
</style>
