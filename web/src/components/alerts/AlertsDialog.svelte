<script>
  import { timeAgo } from "$lib/format.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { alerts } from "$lib/stores/alerts.svelte.js";
  import Button from "../ui/Button.svelte";
  import Modal from "../ui/Modal.svelte";
  import Pill from "../ui/Pill.svelte";
  import NotificationToggle from "./NotificationToggle.svelte";

  // Alerts sent to you in the last week, across your events, and this device's notifications.
  $effect(() => {
    if (alerts.inboxOpen) void alerts.poll();
  });
</script>

<Modal open={alerts.inboxOpen} onclose={() => (alerts.inboxOpen = false)} title="Alerts" size="wide">
  <div class="content">
    <NotificationToggle />

    {#if !account.ready}
      <p class="empty-note">Sign in to see alerts sent to you.</p>
    {:else if alerts.inbox.length}
      <ul>
        {#each alerts.inbox as alert (alert.id)}
          <li class={["alert", alert.urgency, !alert.acknowledgedAt && "unread"]}>
            <div class="top">
              <strong>{alert.title}</strong>
              <Pill tone={alert.urgency === "page" ? "danger" : "default"}>{alert.urgency === "page" ? "Page" : "Notice"}</Pill>
            </div>
            {#if alert.body}<p class="body">{alert.body}</p>{/if}
            <p class="meta">{alert.senderName || alert.senderEmail} · {alert.eventName} · {timeAgo(alert.createdAt)}</p>
            {#if alert.acknowledgedAt}
              <p class="meta">Acknowledged</p>
            {:else}
              <Button variant="quiet" onclick={() => alerts.acknowledge(alert.id)}>{alert.urgency === "page" ? "Acknowledge" : "Mark as seen"}</Button>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty-note">No alerts in the last week.</p>
    {/if}
  </div>
</Modal>

<style>
  .content {
    display: grid;
    gap: 16px;
    margin-top: 14px;
  }

  ul {
    display: grid;
    gap: 8px;
    max-height: min(55vh, 520px);
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  .alert {
    padding: 10px 12px;
    border: 1px solid var(--dialog-line);
    border-left-width: 4px;
    border-radius: var(--radius);
  }

  .alert.page {
    border-left-color: var(--danger);
  }

  .alert.unread {
    background: var(--surface-hover);
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
    opacity: 0.8;
    overflow-wrap: anywhere;
  }
</style>
