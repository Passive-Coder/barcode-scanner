<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";

  /**
   * The events the signed-in person is part of, and a button to create one. Anyone can
   * create an event and becomes its owner.
   * @type {{ onopen: (id: string) => void }}
   */
  let { onopen } = $props();

  let loading = $state(false);
  // Loads once per session; a failed load shows a toast rather than retrying in a loop.
  let requested = false;

  $effect(() => {
    if (!account.ready) {
      requested = false;
      return;
    }
    if (events.loaded || requested) return;
    requested = true;
    loading = true;
    attempt(() => events.load(), "Could not load events").finally(() => (loading = false));
  });

  function create() {
    dialogs.edit({
      title: "Create an event",
      description: "You'll be its owner and first organizer. Add people, sub-teams, and documents next.",
      submitLabel: "Create event",
      fields: [
        { label: "Event name", placeholder: "Spring festival 2026" },
        { label: "Description (optional)", placeholder: "What it's for, when and where" },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the event a name.");
        const detail = await events.create(name.trim(), description.trim());
        onopen(detail.event.id);
      },
    });
  }
</script>

<div class="events">
  <div class="top">
    <Button variant="primary" onclick={create}>New event</Button>
  </div>

  {#if events.list.length}
    <ul>
      {#each events.list as event (event.id)}
        <li>
          <button type="button" class={["item", events.selectedId === event.id && "current"]} aria-current={events.selectedId === event.id || undefined} onclick={() => onopen(event.id)}>
            <span class="name">{event.name}</span>
            <span class="meta">
              <Pill tone={event.role === "organizer" ? "accent" : "default"}>{event.isOwner ? "Owner" : event.role === "organizer" ? "Organizer" : "Member"}</Pill>
              {#if event.isManager}<Pill>Manager</Pill>{/if}
              <span>{pluralize(event.memberCount, "person", "people")}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">
      {loading ? "Loading events…" : "No events yet. Create one, or ask an organizer to add your email to theirs."}
    </p>
  {/if}
</div>

<style>
  .top {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 14px;
  }

  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .item:hover {
    background: var(--surface-hover);
  }

  .current {
    border-color: var(--accent);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .name {
    font-size: 16px;
    font-weight: 650;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .empty {
    margin: 0;
    padding: 20px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    font-size: 14px;
    color: var(--ink-muted);
  }
</style>
