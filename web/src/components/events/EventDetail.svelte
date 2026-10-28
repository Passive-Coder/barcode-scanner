<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import EventAlerts from "./EventAlerts.svelte";
  import EventDocs from "./EventDocs.svelte";
  import EventPeople from "./EventPeople.svelte";
  import EventSubteams from "./EventSubteams.svelte";

  /**
   * One event: its details, documents, people, sub-teams, and alerts. What's offered follows
   * the person's role in this event; the server checks every action again.
   * @type {{ onclosed?: () => void }}
   */
  let { onclosed } = $props();

  let tab = $state("docs");
  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  const managed = $derived(detail ? detail.subteams.filter((subteam) => me?.manages.includes(subteam.id)) : []);

  function editDetails() {
    if (!detail) return;
    dialogs.edit({
      title: "Edit event",
      submitLabel: "Save",
      fields: [
        { label: "Event name", value: detail.event.name },
        { label: "Description (optional)", value: detail.event.description },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the event a name.");
        await events.update({ name: name.trim(), description: description.trim() });
      },
    });
  }

  async function remove() {
    if (!detail) return;
    const confirmed = await dialogs.confirm({
      title: `Delete “${detail.event.name}”?`,
      message: "Its people, sub-teams, document list, and alerts are deleted for everyone. Google Sheets and Docs stay in their owners' Drive, shared as they are now.",
      confirmLabel: "Delete event",
      danger: true,
    });
    if (!confirmed) return;
    if (await attempt(async () => (await events.remove(), true), "Could not delete the event")) {
      toast.show("Event deleted");
      onclosed?.();
    }
  }

  async function leave() {
    if (!detail || !me) return;
    const confirmed = await dialogs.confirm({
      title: `Leave “${detail.event.name}”?`,
      message: "You'll stop seeing its documents and alerts. An organizer can add you again.",
      confirmLabel: "Leave event",
      danger: true,
    });
    if (!confirmed) return;
    if (await attempt(async () => (await events.removePerson(me.email), true), "Could not leave the event")) {
      toast.show("You left the event");
      onclosed?.();
    }
  }
</script>

{#if detail && me}
  <article class="detail">
    <header>
      <div class="titles">
        <h2>{detail.event.name}</h2>
        {#if detail.event.description}<p class="description">{detail.event.description}</p>{/if}
        <div class="roles">
          <Pill tone={me.role === "organizer" ? "accent" : "default"}>{me.isOwner ? "Owner" : me.role === "organizer" ? "Organizer" : "Member"}</Pill>
          {#each managed as subteam (subteam.id)}<Pill>Manager · {subteam.name}</Pill>{/each}
          <span class="count">{pluralize(detail.members.length, "person", "people")}</span>
        </div>
      </div>
      <div class="actions">
        {#if me.canManage}<Button variant="quiet" onclick={editDetails}>Edit details</Button>{/if}
        {#if me.canDelete}
          <Button variant="quiet" tone="danger" onclick={remove}>Delete event</Button>
        {:else}
          <Button variant="quiet" tone="danger" onclick={leave}>Leave event</Button>
        {/if}
      </div>
    </header>

    <Tabs
      label="Event sections"
      bind:value={tab}
      options={[
        { value: "docs", label: "Documents", count: detail.docs.length },
        { value: "people", label: "People", count: detail.members.length },
        { value: "subteams", label: "Sub-teams", count: detail.subteams.length },
        { value: "alerts", label: "Alerts" },
      ]}
    />

    <div class="panel">
      {#if tab === "docs"}
        <EventDocs />
      {:else if tab === "people"}
        <EventPeople />
      {:else if tab === "subteams"}
        <EventSubteams />
      {:else}
        <EventAlerts />
      {/if}
    </div>
  </article>
{:else}
  <p class="empty-note">Loading event…</p>
{/if}

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 16px;
  }

  .titles {
    flex: 1 1 320px;
    min-width: 0;
  }

  h2 {
    font-size: 24px;
    overflow-wrap: anywhere;
  }

  .description {
    margin: 6px 0 0;
    font-size: 15px;
    color: var(--ink-muted);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .count {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .actions {
    display: flex;
    gap: 18px;
  }

  .panel {
    padding-top: 20px;
  }
</style>
