<script>
  import { focusOnOpen } from "$lib/focus.js";
  import { errorMessage, pluralize } from "$lib/format.js";
  import { parsePeople } from "$lib/people.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import Button from "../ui/Button.svelte";
  import DialogActions from "../ui/DialogActions.svelte";
  import Modal from "../ui/Modal.svelte";

  /**
   * Adds people by email: typed or pasted, or copied in from one of your teams.
   * @type {{
   *   title: string,
   *   description?: string,
   *   withRole?: boolean,
   *   excludeTeamId?: string,
   *   onsave: (people: Array<{ email: string, name: string }>, role: "organizer" | "member") => Promise<void>,
   *   onclose: () => void,
   * }}
   */
  let { title, description = "", withRole = false, excludeTeamId = "", onsave, onclose } = $props();

  const id = $props.id();
  let text = $state("");
  /** @type {"organizer" | "member"} */
  let role = $state("member");
  let teamId = $state("");
  let busy = $state(false);
  let error = $state("");
  const parsed = $derived(parsePeople(text));
  const teamChoices = $derived(teams.list.filter((team) => team.id !== excludeTeamId && team.member_count > 0));

  $effect(() => {
    if (account.ready && !teams.loaded) teams.load().catch((failure) => console.warn("Could not load teams.", failure));
  });

  async function addTeam() {
    if (!teamId) return;
    try {
      const members = await teams.members(teamId);
      const lines = members.map((member) => (member.name ? `${member.name} <${member.email}>` : member.email));
      text = [text.trim(), ...lines].filter(Boolean).join("\n");
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
    if (parsed.invalid.length) {
      error = `These aren't email addresses: ${parsed.invalid.slice(0, 3).join(", ")}${parsed.invalid.length > 3 ? "…" : ""}`;
      return;
    }
    if (!parsed.people.length) {
      error = "Add at least one email address.";
      return;
    }
    busy = true;
    try {
      await onsave(parsed.people, role);
      onclose();
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      busy = false;
    }
  }
</script>

<Modal open onclose={() => !busy && onclose()} {title} size="wide" dismissible={!busy}>
  <form onsubmit={submit}>
    {#if description}<p class="intro">{description}</p>{/if}
    <label class="field">
      <span>Emails</span>
      <textarea
        id="{id}-emails"
        class="textarea"
        rows="6"
        bind:value={text}
        disabled={busy}
        placeholder={"Ann Lee <ann@example.com>\nben@example.com"}
        aria-describedby="{id}-hint"
        {@attach focusOnOpen}
      ></textarea>
    </label>
    <p class="hint" id="{id}-hint">
      One per line, or separated by commas. Names are optional.
      {#if parsed.people.length}<strong>{pluralize(parsed.people.length, "person", "people")} to add.</strong>{/if}
    </p>

    {#if teamChoices.length}
      <div class="team">
        <label class="field grow">
          <span>Copy from a team</span>
          <select class="select" bind:value={teamId} disabled={busy}>
            <option value="">Choose a team…</option>
            {#each teamChoices as team (team.id)}<option value={team.id}>{team.name} ({team.member_count})</option>{/each}
          </select>
        </label>
        <Button disabled={!teamId || busy} onclick={addTeam}>Add team</Button>
      </div>
    {/if}

    {#if withRole}
      <fieldset class="choice">
        <legend class="field-label">Add as</legend>
        <label><input type="radio" bind:group={role} value="member" disabled={busy} /> Members — see the event and what's shared with them</label>
        <label><input type="radio" bind:group={role} value="organizer" disabled={busy} /> Organizers — manage the event, its people, documents, and alerts</label>
      </fieldset>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <DialogActions>
      <Button onclick={onclose} disabled={busy}>Cancel</Button>
      <Button type="submit" variant="primary" {busy}>{busy ? "Adding…" : parsed.people.length ? `Add ${pluralize(parsed.people.length, "person", "people")}` : "Add people"}</Button>
    </DialogActions>
  </form>
</Modal>

<style>
  .intro {
    margin: 8px 0 0;
    font-size: 14px;
    opacity: 0.85;
  }

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

  .hint {
    margin: 6px 0 0;
    font-size: 13px;
    opacity: 0.8;
  }

  .team {
    display: flex;
    align-items: end;
    gap: 10px;
  }

  .grow {
    flex: 1;
  }

  .choice {
    display: grid;
    gap: 8px;
    margin: 18px 0 0;
    padding: 0;
    border: 0;
  }

  .choice legend {
    margin-bottom: 4px;
    padding: 0;
  }

  .choice label {
    display: flex;
    align-items: start;
    gap: 10px;
    font-size: 14px;
  }

  input[type="radio"] {
    width: 18px;
    height: 18px;
    flex: none;
    margin: 1px 0 0;
    accent-color: var(--accent);
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
