<script>
  import { untrack } from "svelte";
  import { focusOnOpen } from "$lib/focus.js";
  import { errorMessage, pluralize } from "$lib/format.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";
  import DialogActions from "../ui/DialogActions.svelte";
  import Modal from "../ui/Modal.svelte";
  import PeoplePicker from "../ui/PeoplePicker.svelte";

  /**
   * Creates or edits a sub-team: its name, its people, and which of them manage it. People
   * can be picked from the event, or filled in from one of your teams (anyone not yet in the
   * event is added to it as a member).
   * @type {{ subteam: import("$lib/stores/events.svelte.js").Subteam | null, onclose: () => void }}
   */
  let { subteam, onclose } = $props();

  const start = untrack(() => subteam);
  const detail = $derived(events.detail);
  let name = $state(start?.name ?? "");
  /** @type {string[]} */
  let members = $state(start?.members.map((member) => member.email) ?? []);
  /** @type {string[]} */
  let managers = $state(start?.members.filter((member) => member.isManager).map((member) => member.email) ?? []);
  /** People from a team who aren't in the event yet; they're added to it on save. */
  let newcomers = $state.raw(/** @type {Array<{ email: string, name: string }>} */ ([]));
  let teamId = $state("");
  let busy = $state(false);
  let error = $state("");

  // Newcomers join the event on save, so the event's own list takes over from then on.
  const people = $derived.by(() => {
    const members = (detail?.members ?? []).map((member) => ({ email: member.email, name: member.name }));
    const known = new Set(members.map((member) => member.email));
    return [...members, ...newcomers.filter((person) => !known.has(person.email))];
  });

  $effect(() => {
    if (account.ready && !teams.loaded) teams.load().catch((failure) => console.warn("Could not load teams.", failure));
  });

  async function fillFromTeam() {
    if (!teamId || !detail) return;
    try {
      const teamMembers = await teams.members(teamId);
      const known = new Set(people.map((person) => person.email));
      newcomers = [...newcomers, ...teamMembers.filter((member) => !known.has(member.email)).map((member) => ({ email: member.email, name: member.name }))];
      members = [...new Set([...members, ...teamMembers.map((member) => member.email)])];
      teamId = "";
    } catch (failure) {
      error = errorMessage(failure);
    }
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    error = "";
    if (!name.trim()) {
      error = "Give the sub-team a name.";
      return;
    }
    busy = true;
    try {
      const joining = newcomers.filter((person) => members.includes(person.email));
      if (joining.length) await events.addPeople(joining, "member");
      await events.saveSubteam(start?.id ?? null, { name: name.trim(), members, managers });
      toast.show(start ? "Sub-team saved" : `Sub-team created${joining.length ? `; ${pluralize(joining.length, "person", "people")} added to the event` : ""}`);
      onclose();
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      busy = false;
    }
  }
</script>

<Modal open onclose={() => !busy && onclose()} title={start ? `Edit “${start.name}”` : "New sub-team"} size="wide" dismissible={!busy}>
  <form onsubmit={submit}>
    <label class="field">
      <span>Name</span>
      <input class="input" bind:value={name} placeholder="Logistics" required disabled={busy} {@attach focusOnOpen} />
    </label>

    {#if teams.list.length}
      <div class="team">
        <label class="field grow">
          <span>Fill from a team</span>
          <select class="select" bind:value={teamId} disabled={busy}>
            <option value="">Choose a team…</option>
            {#each teams.list as team (team.id)}<option value={team.id}>{team.name} ({team.member_count})</option>{/each}
          </select>
        </label>
        <Button disabled={!teamId || busy} onclick={fillFromTeam}>Add team</Button>
      </div>
    {/if}

    <div class="picker">
      <PeoplePicker label="People and managers" {people} bind:selected={members} bind:managers disabled={busy} />
    </div>
    {#if newcomers.some((person) => members.includes(person.email))}
      {@const joining = newcomers.filter((person) => members.includes(person.email)).length}
      <p class="note">{pluralize(joining, "person", "people")} from the team will also be added to the event as {joining === 1 ? "a member" : "members"}.</p>
    {/if}
    <p class="note">Managers can page this sub-team's members and see who has acknowledged.</p>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <DialogActions>
      <Button onclick={onclose} disabled={busy}>Cancel</Button>
      <Button type="submit" variant="primary" {busy}>{busy ? "Saving…" : start ? "Save sub-team" : "Create sub-team"}</Button>
    </DialogActions>
  </form>
</Modal>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;
  }

  .field span {
    font-size: 13px;
    font-weight: 600;
  }

  .team {
    display: flex;
    align-items: end;
    gap: 10px;
  }

  .grow {
    flex: 1;
  }

  .picker {
    margin-top: 18px;
  }

  .note {
    margin: 8px 0 0;
    font-size: 13px;
    opacity: 0.8;
  }

  .error {
    margin: 16px 0 0;
    padding: 10px 12px;
    border-left: 3px solid var(--danger);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    font-size: 13px;
  }
</style>
