<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import Button from "../ui/Button.svelte";

  /**
   * Your teams: lists of people you work with, to add to events and sub-teams in one go.
   * @type {{ onopen: (id: string) => void }}
   */
  let { onopen } = $props();

  let loading = $state(false);
  let requested = false;

  $effect(() => {
    if (!account.ready) {
      requested = false;
      return;
    }
    if (teams.loaded || requested) return;
    requested = true;
    loading = true;
    attempt(() => teams.load(), "Could not load teams").finally(() => (loading = false));
  });

  function create() {
    dialogs.edit({
      title: "Create a team",
      description: "A list of people you work with. Only you can see it.",
      submitLabel: "Create team",
      fields: [
        { label: "Team name", placeholder: "Volunteers" },
        { label: "Description (optional)", placeholder: "Who they are" },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the team a name.");
        const team = await teams.create(name.trim(), description.trim());
        onopen(team.id);
      },
    });
  }
</script>

<div class="teams">
  <div class="top">
    <Button variant="primary" onclick={create}>New team</Button>
  </div>
  {#if teams.list.length}
    <ul>
      {#each teams.list as team (team.id)}
        <li>
          <button type="button" class={["item", teams.selectedId === team.id && "current"]} aria-current={teams.selectedId === team.id || undefined} onclick={() => onopen(team.id)}>
            <span class="name">{team.name}</span>
            <span class="meta">{pluralize(team.member_count, "person", "people")}{team.description ? ` · ${team.description}` : ""}</span>
            <span class="action-hint">Open to edit or delete this team</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{loading ? "Loading teams…" : "No teams yet. A team is a list of names and emails you can add to any event at once."}</p>
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
    gap: 4px;
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
    font-size: 13px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .action-hint {
    font-size: 12px;
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
