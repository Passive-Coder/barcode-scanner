<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { displayName } from "$lib/people.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import AddPeopleDialog from "../people/AddPeopleDialog.svelte";
  import Button from "../ui/Button.svelte";

  /**
   * One team: its people (names and emails), with ways to add, remove, rename, and delete.
   * @type {{ onclosed?: () => void }}
   */
  let { onclosed } = $props();

  const detail = $derived(teams.detail);
  let adding = $state(false);
  let query = $state("");
  const shown = $derived.by(() => {
    const term = query.trim().toLowerCase();
    const members = detail?.members ?? [];
    return term ? members.filter((member) => member.email.includes(term) || member.name.toLowerCase().includes(term)) : members;
  });

  function edit() {
    if (!detail) return;
    dialogs.edit({
      title: "Edit team",
      submitLabel: "Save",
      fields: [
        { label: "Team name", value: detail.team.name },
        { label: "Description (optional)", value: detail.team.description },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the team a name.");
        await teams.update({ name: name.trim(), description: description.trim() });
      },
    });
  }

  async function remove() {
    if (!detail) return;
    const confirmed = await dialogs.confirm({
      title: `Delete “${detail.team.name}”?`,
      message: "The list is deleted. Events and sub-teams you added these people to aren't changed.",
      confirmLabel: "Delete team",
      danger: true,
    });
    if (confirmed && (await attempt(async () => (await teams.remove(), true), "Could not delete the team"))) {
      toast.show("Team deleted");
      onclosed?.();
    }
  }

  /** @param {Array<{ email: string, name: string }>} people */
  async function add(people) {
    await teams.addPeople(people);
    toast.show(`${pluralize(people.length, "person", "people")} added to the team`);
  }

  /** @param {{ email: string, name: string }} member */
  async function removePerson(member) {
    await attempt(() => teams.removePerson(member.email), "Could not remove the person");
  }
</script>

{#if detail}
  <article>
    <header>
      <div class="titles">
        <h2>{detail.team.name}</h2>
        {#if detail.team.description}<p class="description">{detail.team.description}</p>{/if}
        <p class="count">{pluralize(detail.members.length, "person", "people")} · only you can see this team</p>
      </div>
      <div class="actions">
        <Button variant="quiet" onclick={edit}>Edit team</Button>
        <Button variant="quiet" tone="danger" onclick={remove}>Delete team</Button>
      </div>
    </header>

    <div class="tools">
      <input class="input" type="search" placeholder="Search people" aria-label="Search people" bind:value={query} />
      <Button variant="primary" onclick={() => (adding = true)}>Add people</Button>
    </div>

    {#if detail.members.length}
      <ul class="people">
        {#each shown as member (member.email)}
          <li>
            <div class="who">
              <strong>{displayName(member)}</strong>
              {#if member.name}<span>{member.email}</span>{/if}
            </div>
            <Button variant="quiet" tone="danger" aria-label="Remove {displayName(member)}" onclick={() => removePerson(member)}>Remove</Button>
          </li>
        {:else}
          <li class="empty-note">No one matches that search.</li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No one in this team yet. Add people by pasting their emails.</p>
    {/if}
  </article>

  {#if adding}
    <AddPeopleDialog title="Add people to {detail.team.name}" excludeTeamId={detail.team.id} onsave={add} onclose={() => (adding = false)} />
  {/if}
{:else}
  <p class="empty-note">Loading team…</p>
{/if}

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 18px;
  }

  .titles {
    flex: 1 1 280px;
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
    overflow-wrap: anywhere;
  }

  .count {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .actions {
    display: flex;
    gap: 18px;
  }

  .tools {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }

  .tools .input {
    max-width: 360px;
  }

  .people {
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
    list-style: none;
  }

  .people li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }

  .who {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  strong {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .who span {
    font-size: 13px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
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
