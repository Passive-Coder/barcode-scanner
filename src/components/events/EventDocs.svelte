<script>
  import { attempt } from "$lib/feedback.js";
  import { pluralize } from "$lib/format.js";
  import { DRIVE_FILE_SCOPE, fileUrl } from "$lib/google/drive-client.js";
  import { openSheetInLinework } from "$lib/navigation.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";
  import DocDialog from "./DocDialog.svelte";

  /** @typedef {import("$lib/stores/events.svelte.js").EventDoc} EventDoc */

  const detail = $derived(events.detail);
  const me = $derived(detail?.me);
  /** @type {{ mode: "create" | "link" | "edit", kind: "sheet" | "doc", doc?: EventDoc } | null} */
  let dialog = $state(null);
  /** @type {string | null} */
  let opening = $state(null);

  /** @param {EventDoc} doc */
  function audienceLabel(doc) {
    if (doc.audience === "organizers") return "Organizers only";
    const who = doc.audience === "everyone" ? "Everyone" : (detail?.subteams.filter((subteam) => doc.subteamIds.includes(subteam.id)).map((subteam) => subteam.name).join(", ") || "No sub-teams");
    return `${who} · ${doc.access === "writer" ? "can edit" : "can view"}`;
  }

  /** @param {EventDoc} doc */
  function sharingLabel(doc) {
    if (!doc.managed) return "Shared by its owner in Google";
    if (!doc.sharing) return "";
    const parts = [`Shared with ${pluralize(doc.sharing.shared, "person", "people")}`];
    if (doc.sharing.pending) parts.push(`${doc.sharing.pending} waiting`);
    return parts.join(" · ");
  }

  /** @param {EventDoc} doc */
  async function openInLinework(doc) {
    opening = doc.id;
    await attempt(() => openSheetInLinework(doc.fileId), "Could not open the spreadsheet");
    opening = null;
  }

  /** @param {EventDoc} doc @param {boolean} retry */
  async function share(doc, retry) {
    if (!detail) return;
    const result = await attempt(async () => {
      // Google may ask for Drive access first, which is why this runs from a click.
      await auth.grant(DRIVE_FILE_SCOPE);
      return events.syncSharing(detail.event.id, doc.id, { retry });
    }, "Could not update sharing");
    if (!result) return;
    if (result.failed) toast.error(`Couldn't share “${doc.title}” with ${pluralize(result.failed, "person", "people")}. See the details under the document.`);
    else toast.show(`Sharing for “${doc.title}” is up to date`);
  }

  /** @param {EventDoc} doc */
  async function remove(doc) {
    const confirmed = await dialogs.confirm({
      title: `Remove “${doc.title}” from the event?`,
      message: "It disappears from the event's list. The file itself stays in its owner's Google Drive, and the people it was shared with keep access until its owner changes that in Google.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (confirmed) await attempt(() => events.removeDoc(doc.id), "Could not remove the document");
  }
</script>

{#if detail && me}
  {#if me.canManage}
    <div class="create">
      <Button variant="primary" onclick={() => (dialog = { mode: "create", kind: "sheet" })}>New Google Sheet</Button>
      <Button onclick={() => (dialog = { mode: "create", kind: "doc" })}>New Google Doc</Button>
      <Button variant="quiet" onclick={() => (dialog = { mode: "link", kind: "sheet" })}>Link an existing file</Button>
    </div>
  {/if}

  {#if detail.docs.length}
    <ul class="docs">
      {#each detail.docs as doc (doc.id)}
        {@const syncing = events.syncing.includes(doc.id)}
        <li class="doc">
          <span class={["glyph", doc.kind]} aria-hidden="true"></span>
          <div class="body">
            <div class="title-row">
              <strong>{doc.title}</strong>
              <Pill>{doc.kind === "sheet" ? "Sheet" : "Doc"}</Pill>
              {#if doc.myAccess === "reader"}<Pill>View only</Pill>{/if}
            </div>
            <p class="meta">{audienceLabel(doc)}</p>
            {#if doc.sharing || !doc.managed}<p class="meta">{syncing ? "Updating sharing…" : sharingLabel(doc)}</p>{/if}
            {#if doc.sharing?.pending && doc.createdBy !== me.email}
              <p class="note">Sharing changes are made from {doc.createdBy}'s Google account, the next time they open Linework.</p>
            {/if}
            {#if doc.sharing?.failed.length}
              <details class="failed">
                <summary>Couldn't share with {pluralize(doc.sharing.failed.length, "person", "people")}</summary>
                <ul>
                  {#each doc.sharing.failed as failure (failure.email)}<li><strong>{failure.email}</strong> — {failure.error || "Google refused"}</li>{/each}
                </ul>
              </details>
            {/if}
            <div class="links">
              {#if doc.kind === "sheet"}
                <Button variant="quiet" busy={opening === doc.id} onclick={() => openInLinework(doc)}>Open in Linework</Button>
              {/if}
              <a href={fileUrl(doc.kind, doc.fileId)} target="_blank" rel="noopener noreferrer">Open in Google {doc.kind === "sheet" ? "Sheets" : "Docs"}</a>
              {#if doc.managed && doc.createdBy === me.email && (doc.sharing?.pending || doc.sharing?.failed.length)}
                <Button variant="quiet" disabled={syncing} onclick={() => share(doc, Boolean(doc.sharing?.failed.length))}>{doc.sharing?.pending ? "Share now" : "Retry sharing"}</Button>
              {/if}
              {#if me.canManage}
                <Button variant="quiet" onclick={() => (dialog = { mode: "edit", kind: doc.kind, doc })}>Access</Button>
                <Button variant="quiet" tone="danger" onclick={() => remove(doc)}>Remove</Button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">
      {me.canManage ? "No documents yet. Create a Google Sheet or Doc for this event, and Linework shares it with the people you choose." : "No documents have been shared with you in this event yet."}
    </p>
  {/if}

  {#if dialog}
    <DocDialog mode={dialog.mode} kind={dialog.kind} doc={dialog.doc} onclose={() => (dialog = null)} />
  {/if}
{/if}

<style>
  .create {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-bottom: 18px;
  }

  .docs {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .doc {
    display: flex;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  /* A page with a folded corner, green for Sheets and blue for Docs, like Google's icons. */
  .glyph {
    position: relative;
    width: 26px;
    height: 34px;
    flex: none;
    margin-top: 2px;
    border-radius: 3px;
    clip-path: polygon(0 0, 68% 0, 100% 26%, 100% 100%, 0 100%);
  }

  .glyph.sheet {
    background: #1e8e4e;
  }

  .glyph.doc {
    background: #3b6fd8;
  }

  .glyph::after {
    content: "";
    position: absolute;
    left: 6px;
    right: 6px;
    top: 14px;
    height: 12px;
    background: repeating-linear-gradient(to bottom, #ffffffd9 0 2px, transparent 2px 5px);
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  strong {
    font-size: 15px;
    font-weight: 650;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  .meta {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .note {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--ink);
  }

  .failed {
    margin-top: 6px;
    font-size: 13px;
  }

  .failed summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--danger);
  }

  .failed ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }

  .failed strong {
    font-size: 13px;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 18px;
    margin-top: 8px;
  }

  .links a {
    font-size: 13px;
    font-weight: 600;
    color: var(--link);
  }

  .links a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
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
