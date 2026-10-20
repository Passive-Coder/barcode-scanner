<script>
  import { untrack } from "svelte";
  import { focusOnOpen } from "$lib/focus.js";
  import { errorMessage, pluralize } from "$lib/format.js";
  import { parseFileLink } from "$lib/google/drive-client.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";
  import DialogActions from "../ui/DialogActions.svelte";
  import Modal from "../ui/Modal.svelte";

  /**
   * Creates a Google Sheet or Doc for the event, links an existing one, or changes who a
   * listed document is for.
   * @type {{
   *   mode: "create" | "link" | "edit",
   *   kind: "sheet" | "doc",
   *   doc?: import("$lib/stores/events.svelte.js").EventDoc,
   *   onclose: () => void,
   * }}
   */
  let { mode, kind: initialKind, doc, onclose } = $props();

  const id = $props.id();
  const detail = $derived(events.detail);
  const start = untrack(() => ({ doc, kind: initialKind }));

  let title = $state(start.doc?.title ?? "");
  let link = $state("");
  /** @type {"sheet" | "doc"} */
  let kind = $state(start.doc?.kind ?? start.kind);
  /** @type {"everyone" | "organizers" | "subteams"} */
  let audience = $state(start.doc?.audience ?? "everyone");
  /** @type {"writer" | "reader"} */
  let access = $state(start.doc?.access ?? "writer");
  /** @type {string[]} */
  let subteamIds = $state(start.doc?.subteamIds ?? []);
  let busy = $state(false);
  let error = $state("");

  const label = $derived(kind === "sheet" ? "Google Sheet" : "Google Doc");
  const heading = $derived(mode === "create" ? `New ${label}` : mode === "link" ? "Link an existing file" : `Access to “${start.doc?.title}”`);
  const linkedKind = $derived.by(() => {
    try {
      return link.trim() ? parseFileLink(link).kind : null;
    } catch {
      return null;
    }
  });
  const reach = $derived.by(() => {
    if (!detail) return 0;
    if (audience === "everyone") return detail.members.length;
    if (audience === "organizers") return detail.members.filter((member) => member.role === "organizer").length;
    return new Set([...detail.subteams.filter((subteam) => subteamIds.includes(subteam.id)).flatMap((subteam) => subteam.members.map((member) => member.email)), ...detail.members.filter((member) => member.role === "organizer").map((member) => member.email)]).size;
  });

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    error = "";
    if (mode !== "edit" && !title.trim()) {
      error = "Give the document a title.";
      return;
    }
    if (audience === "subteams" && !subteamIds.length) {
      error = "Choose at least one sub-team.";
      return;
    }
    busy = true;
    const settings = { kind: linkedKind ?? kind, title: title.trim(), audience, access, subteamIds: audience === "subteams" ? subteamIds : [] };
    try {
      if (mode === "create") {
        const { sharing } = await events.createDoc(settings);
        toast.show(
          sharing.failed ? `${label} created. Sharing failed for ${pluralize(sharing.failed, "person", "people")}; see the document's details.` : `${label} created and shared with ${pluralize(sharing.shared, "person", "people")}`,
        );
      } else if (mode === "link") {
        await events.linkDoc({ link, ...settings });
        toast.show("Document linked");
      } else if (start.doc) {
        await events.updateDoc(start.doc.id, { title: settings.title || start.doc.title, audience, access, subteamIds: settings.subteamIds });
        toast.show(start.doc.managed ? "Access updated. Sharing in Google follows." : "Access updated");
      }
      onclose();
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      busy = false;
    }
  }
</script>

<Modal open onclose={() => !busy && onclose()} title={heading} size="wide" dismissible={!busy}>
  <form onsubmit={submit}>
    {#if mode === "create"}
      <p class="intro">Linework creates the {label} in your Google Drive and shares it with the people below. Google emails each of them a link.</p>
    {:else if mode === "link"}
      <p class="intro">Lists a file you already have. Linework can't change its sharing, so share it in Google with the people below yourself.</p>
    {:else if start.doc?.managed}
      <p class="intro">Linework updates the file's sharing in Google Drive to match, from {start.doc.createdBy}'s account.</p>
    {/if}

    <div class="fields">
      {#if mode === "link"}
        <label class="field">
          <span>Google Sheets or Docs link</span>
          <input class="input" bind:value={link} placeholder="https://docs.google.com/…" required disabled={busy} {@attach focusOnOpen} />
        </label>
        {#if link.trim() && !linkedKind}
          <fieldset class="choice">
            <legend class="field-label">This file is a</legend>
            <label><input type="radio" bind:group={kind} value="sheet" /> Google Sheet</label>
            <label><input type="radio" bind:group={kind} value="doc" /> Google Doc</label>
          </fieldset>
        {/if}
      {/if}

      <label class="field">
        <span>Title</span>
        {#if mode === "link"}
          <input id="{id}-title" class="input" bind:value={title} placeholder={kind === "sheet" ? "Inventory" : "Run of show"} required disabled={busy} />
        {:else}
          <input id="{id}-title" class="input" bind:value={title} placeholder={kind === "sheet" ? "Inventory" : "Run of show"} required={mode !== "edit"} disabled={busy} {@attach focusOnOpen} />
        {/if}
      </label>

      <fieldset class="choice">
        <legend class="field-label">Who it's for</legend>
        <label><input type="radio" bind:group={audience} value="everyone" disabled={busy} /> Everyone in the event</label>
        <label><input type="radio" bind:group={audience} value="subteams" disabled={busy || !detail?.subteams.length} /> Specific sub-teams{detail?.subteams.length ? "" : " (create a sub-team first)"}</label>
        {#if audience === "subteams" && detail}
          <div class="choice indent" role="group" aria-label="Sub-teams">
            {#each detail.subteams as subteam (subteam.id)}
              <label><input type="checkbox" bind:group={subteamIds} value={subteam.id} disabled={busy} /> {subteam.name} <span class="muted">({subteam.members.length})</span></label>
            {/each}
          </div>
        {/if}
        <label><input type="radio" bind:group={audience} value="organizers" disabled={busy} /> Organizers only</label>
      </fieldset>

      {#if audience !== "organizers"}
        <fieldset class="choice">
          <legend class="field-label">They can</legend>
          <label><input type="radio" bind:group={access} value="writer" disabled={busy} /> Edit</label>
          <label><input type="radio" bind:group={access} value="reader" disabled={busy} /> View only</label>
        </fieldset>
      {/if}

      <p class="reach">Organizers can always edit. {pluralize(reach, "person", "people")} will have access.</p>
    </div>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <DialogActions>
      <Button onclick={onclose} disabled={busy}>Cancel</Button>
      <Button type="submit" variant="primary" {busy}>
        {busy ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? `Create ${label}` : mode === "link" ? "Link file" : "Save access"}
      </Button>
    </DialogActions>
  </form>
</Modal>

<style>
  .intro {
    margin: 8px 0 0;
    font-size: 14px;
    opacity: 0.85;
  }

  .fields {
    display: grid;
    gap: 16px;
    margin-top: 18px;
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
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }

  .indent {
    margin: 0 0 4px 28px;
  }

  input[type="radio"],
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .reach {
    margin: 0;
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
