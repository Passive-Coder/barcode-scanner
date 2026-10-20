<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { displayName } from "$lib/people.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import Button from "../ui/Button.svelte";
  import SubteamDialog from "./SubteamDialog.svelte";

  /** @typedef {import("$lib/stores/events.svelte.js").Subteam} Subteam */

  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  /** @type {{ subteam: Subteam | null } | null} */
  let editing = $state(null);

  const names = $derived(new Map((detail?.members ?? []).map((member) => [member.email, displayName(member)])));

  /** @param {Subteam} subteam */
  async function remove(subteam) {
    const confirmed = await dialogs.confirm({
      title: `Delete the “${subteam.name}” sub-team?`,
      message: "Its people stay in the event. Documents shared only with this sub-team lose that audience, and its managers can no longer page it.",
      confirmLabel: "Delete sub-team",
      danger: true,
    });
    if (confirmed) await attempt(() => events.deleteSubteam(subteam.id), "Could not delete the sub-team");
  }
</script>

{#if detail && me}
  <p class="intro">
    Sub-teams group people within the event. Their managers can page the sub-team's members{me.canManage ? ", and documents can be shared with a sub-team" : ""}.
  </p>
  {#if me.canManage}
    <div class="tools">
      <Button variant="primary" onclick={() => (editing = { subteam: null })}>New sub-team</Button>
    </div>
  {/if}

  {#if detail.subteams.length}
    <ul class="subteams">
      {#each detail.subteams as subteam (subteam.id)}
        {@const managers = subteam.members.filter((member) => member.isManager)}
        <li class={["subteam", me.subteams.includes(subteam.id) && "mine"]}>
          <div class="head">
            <div>
              <strong>{subteam.name}</strong>
              <span class="meta">
                {pluralize(subteam.members.length, "person", "people")}
                {#if managers.length}· managed by {managers.map((manager) => names.get(manager.email) ?? manager.email).join(", ")}{/if}
                {#if me.subteams.includes(subteam.id)}· you're in it{/if}
              </span>
            </div>
            {#if me.canManage}
              <div class="actions">
                <Button variant="quiet" onclick={() => (editing = { subteam })}>Edit</Button>
                <Button variant="quiet" tone="danger" onclick={() => remove(subteam)}>Delete</Button>
              </div>
            {/if}
          </div>
          {#if subteam.members.length}
            <ul class="chips">
              {#each subteam.members as member (member.email)}
                <li class={{ manager: member.isManager }}>{names.get(member.email) ?? member.email}{member.isManager ? " · manager" : ""}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{me.canManage ? "No sub-teams yet. Create one from the event's people, or fill it from one of your teams." : "This event has no sub-teams yet."}</p>
  {/if}

  {#if editing}
    <SubteamDialog subteam={editing.subteam} onclose={() => (editing = null)} />
  {/if}
{/if}

<style>
  .intro {
    margin: 0 0 14px;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .tools {
    margin-bottom: 14px;
  }

  .subteams {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .subteam {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .subteam.mine {
    border-color: var(--line-strong);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 8px 16px;
  }

  .head > div:first-child {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  strong {
    font-size: 16px;
    font-weight: 650;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .actions {
    display: flex;
    gap: 16px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .chips li {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--surface-sunk);
    font-size: 13px;
  }

  .chips li.manager {
    font-weight: 600;
    box-shadow: inset 0 0 0 1px var(--line-strong);
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
