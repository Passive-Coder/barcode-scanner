<script>
  import { untrack } from "svelte";
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { displayName } from "$lib/people.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";
  import PeoplePicker from "../ui/PeoplePicker.svelte";

  /**
   * Sends an alert. Organizers can alert everyone, sub-teams, or tagged people; managers can
   * alert the sub-teams they manage, or tag people in them. A page takes over the
   * recipients' screens until they acknowledge it.
   */
  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  const organizer = $derived(me?.role === "organizer");

  let title = $state("");
  let body = $state("");
  /** @type {"notice" | "page"} */
  let urgency = $state("page");
  // Organizers usually alert everyone; managers start from the sub-teams they manage.
  const initial = untrack(() => events.detail?.me);
  /** @type {"everyone" | "subteams" | "people"} */
  let audience = $state(initial?.role === "organizer" ? "everyone" : "subteams");
  /** @type {string[]} */
  let subteamIds = $state(initial?.role === "organizer" ? [] : [...(initial?.manages ?? [])]);
  /** @type {string[]} */
  let emails = $state([]);
  let busy = $state(false);

  /** Sub-teams this person may alert. */
  const subteams = $derived((detail?.subteams ?? []).filter((subteam) => organizer || me?.manages.includes(subteam.id)));
  /** People this person may tag: anyone (organizers) or members of their sub-teams (managers). */
  const reachable = $derived.by(() => {
    if (!detail || !me) return [];
    const allowed = organizer ? null : new Set(subteams.flatMap((subteam) => subteam.members.map((member) => member.email)));
    return detail.members.filter((member) => member.email !== me.email && (!allowed || allowed.has(member.email))).map((member) => ({ email: member.email, name: member.name }));
  });
  const recipients = $derived.by(() => {
    if (!detail || !me) return 0;
    if (audience === "everyone") return detail.members.filter((member) => member.email !== me.email).length;
    if (audience === "people") return emails.length;
    return new Set(subteams.filter((subteam) => subteamIds.includes(subteam.id)).flatMap((subteam) => subteam.members.map((member) => member.email)).filter((email) => email !== me.email)).size;
  });

  function audiencePayload() {
    if (audience === "everyone") return /** @type {const} */ ({ type: "everyone" });
    if (audience === "subteams") return { type: /** @type {const} */ ("subteams"), subteamIds };
    return { type: /** @type {const} */ ("people"), emails };
  }

  function audienceText() {
    if (audience === "everyone") return "everyone in the event";
    if (audience === "people") return emails.length === 1 ? displayName(reachable.find((person) => person.email === emails[0]) ?? { email: emails[0] }) : pluralize(emails.length, "person", "people");
    return subteams.filter((subteam) => subteamIds.includes(subteam.id)).map((subteam) => subteam.name).join(", ");
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) return toast.error("Give the alert a title.");
    if (audience === "subteams" && !subteamIds.length) return toast.error("Choose at least one sub-team.");
    if (audience === "people" && !emails.length) return toast.error("Tag at least one person.");
    if (!recipients) return toast.error("There's no one else in that audience to alert.");
    if (urgency === "page") {
      const confirmed = await dialogs.confirm({
        title: `Page ${audienceText()}?`,
        message: `${pluralize(recipients, "person", "people")} will see “${title.trim()}” fill their screen until they acknowledge it, and get a notification on devices where they turned alerts on.`,
        confirmLabel: "Send page",
        danger: true,
      });
      if (!confirmed) return;
    }
    busy = true;
    const sent = await attempt(() => events.sendAlert({ title: title.trim(), body: body.trim(), urgency, audience: audiencePayload() }), "Could not send the alert");
    busy = false;
    if (!sent) return;
    toast.show(`${urgency === "page" ? "Page" : "Alert"} sent to ${pluralize(sent.recipientCount ?? recipients, "person", "people")}${sent.devices ? ` (${pluralize(sent.devices, "device")} notified)` : ""}`);
    title = "";
    body = "";
    emails = [];
  }
</script>

{#if detail && me}
  <form class="composer" onsubmit={submit}>
    <h3>Send an alert</h3>
    <div class="row">
      <label class="field grow">
        <span>Title</span>
        <input class="input" bind:value={title} maxlength="120" placeholder="Doors open in 10 minutes" disabled={busy} />
      </label>
    </div>
    <label class="field">
      <span>Message (optional)</span>
      <textarea class="textarea" rows="3" bind:value={body} maxlength="1000" placeholder="Everyone to the main gate." disabled={busy}></textarea>
    </label>

    <div class="options">
      <fieldset class="choice">
        <legend class="field-label">How</legend>
        <label><input type="radio" bind:group={urgency} value="page" disabled={busy} /> Page — fills their screen until acknowledged</label>
        <label><input type="radio" bind:group={urgency} value="notice" disabled={busy} /> Notice — a notification and a note in their alerts</label>
      </fieldset>

      <fieldset class="choice">
        <legend class="field-label">To</legend>
        {#if organizer}<label><input type="radio" bind:group={audience} value="everyone" disabled={busy} /> Everyone in the event</label>{/if}
        <label><input type="radio" bind:group={audience} value="subteams" disabled={busy || !subteams.length} /> {organizer ? "Sub-teams" : "Your sub-teams"}{subteams.length ? "" : " (none yet)"}</label>
        <label><input type="radio" bind:group={audience} value="people" disabled={busy || !reachable.length} /> Tag people</label>
      </fieldset>
    </div>

    {#if audience === "subteams"}
      <fieldset class="choice inline">
        <legend class="visually-hidden">Sub-teams to alert</legend>
        {#each subteams as subteam (subteam.id)}
          <label><input type="checkbox" bind:group={subteamIds} value={subteam.id} disabled={busy} /> {subteam.name} <span class="muted">({subteam.members.length})</span></label>
        {/each}
      </fieldset>
    {:else if audience === "people"}
      <PeoplePicker label="People to tag" people={reachable} bind:selected={emails} disabled={busy} />
    {/if}

    <div class="send">
      <span class="muted">{recipients ? `${pluralize(recipients, "person", "people")} will be alerted` : "Choose who to alert"}</span>
      <Button type="submit" variant="primary" tone={urgency === "page" ? "danger" : "default"} {busy}>{busy ? "Sending…" : urgency === "page" ? "Send page" : "Send notice"}</Button>
    </div>
  </form>
{/if}

<style>
  .composer {
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  h3 {
    font-size: 17px;
  }

  .row {
    display: flex;
    gap: 12px;
  }

  .grow {
    flex: 1;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field span {
    font-size: 13px;
    font-weight: 600;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px 24px;
  }

  .choice {
    display: grid;
    gap: 8px;
    margin: 0;
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

  .choice.inline {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
  }

  input[type="radio"],
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    flex: none;
    margin: 1px 0 0;
    accent-color: var(--accent);
  }

  .send {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
  }
</style>
