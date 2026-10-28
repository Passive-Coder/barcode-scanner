<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { displayName } from "$lib/people.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import AddPeopleDialog from "../people/AddPeopleDialog.svelte";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";

  /** @typedef {import("$lib/stores/events.svelte.js").EventMember} EventMember */

  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  let adding = $state(false);
  let query = $state("");

  /** Sub-teams each person manages, by email. */
  const managing = $derived.by(() => {
    /** @type {Map<string, string[]>} */
    const map = new Map();
    for (const subteam of detail?.subteams ?? []) {
      for (const member of subteam.members) if (member.isManager) map.set(member.email, [...(map.get(member.email) ?? []), subteam.name]);
    }
    return map;
  });
  const shown = $derived.by(() => {
    const term = query.trim().toLowerCase();
    const members = detail?.members ?? [];
    return term ? members.filter((member) => member.email.includes(term) || member.name.toLowerCase().includes(term)) : members;
  });

  /** @param {Array<{ email: string, name: string }>} people @param {"organizer" | "member"} role */
  async function add(people, role) {
    await events.addPeople(people, role);
    toast.show(`${pluralize(people.length, "person", "people")} added. Shared documents will reach them shortly.`);
  }

  /** @param {EventMember} member @param {"organizer" | "member"} role */
  async function setRole(member, role) {
    if (role === member.role) return;
    if (member.email === me?.email && role === "member") {
      const confirmed = await dialogs.confirm({ title: "Stop being an organizer?", message: "You won't be able to manage this event any more unless another organizer makes you one again.", confirmLabel: "Become a member", danger: true });
      if (!confirmed) return;
    }
    await attempt(() => events.setRole(member.email, role), "Could not change the role");
  }

  /** @param {EventMember} member */
  async function remove(member) {
    const confirmed = await dialogs.confirm({
      title: `Remove ${displayName(member)}?`,
      message: "They leave the event and its sub-teams, stop receiving its alerts, and lose access to documents Linework shared with them.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (confirmed) await attempt(() => events.removePerson(member.email), "Could not remove the person");
  }
</script>

{#if detail && me}
  <div class="tools">
    <input class="input" type="search" placeholder="Search people" aria-label="Search people" bind:value={query} />
    {#if me.canManage}<Button variant="primary" onclick={() => (adding = true)}>Add people</Button>{/if}
  </div>

  <ul class="people">
    {#each shown as member (member.email)}
      <li class="person">
        <div class="who">
          <strong>{displayName(member)}{member.email === me.email ? " (you)" : ""}</strong>
          {#if member.name}<span class="email">{member.email}</span>{/if}
          <div class="tags">
            {#if member.isOwner}<Pill tone="accent">Owner</Pill>{:else if member.role === "organizer"}<Pill tone="accent">Organizer</Pill>{/if}
            {#each managing.get(member.email) ?? [] as name (name)}<Pill>Manager · {name}</Pill>{/each}
            {#if !member.hasAccount}<span class="note">Hasn't signed in to Linework yet</span>{/if}
          </div>
        </div>
        {#if me.canManage && !member.isOwner}
          <div class="actions">
            <select class="select role" aria-label="Role for {displayName(member)}" value={member.role} onchange={(event) => setRole(member, /** @type {"organizer" | "member"} */ (event.currentTarget.value))}>
              <option value="member">Member</option>
              <option value="organizer">Organizer</option>
            </select>
            <Button variant="quiet" tone="danger" aria-label="Remove {displayName(member)}" onclick={() => remove(member)}>Remove</Button>
          </div>
        {/if}
      </li>
    {:else}
      <li class="empty-note">No one matches that search.</li>
    {/each}
  </ul>

  {#if adding}
    <AddPeopleDialog
      title="Add people to {detail.event.name}"
      description="They'll see the event in Linework when they sign in with these Google accounts, and get the documents and alerts meant for them."
      withRole
      onsave={add}
      onclose={() => (adding = false)}
    />
  {/if}
{/if}

<style>
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

  .person {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    padding: 12px 0;
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

  .email {
    font-size: 13px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .tags:empty {
    display: none;
  }

  .note {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .role {
    width: auto;
    min-height: 36px;
    font-size: 14px;
  }
</style>
