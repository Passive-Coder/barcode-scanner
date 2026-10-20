<script>
  import { attempt } from "$lib/feedback.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";

  /**
   * @type {{
   *   label?: string,
   *   submitLabel?: string,
   *   layout?: "inline" | "stacked",
   *   onlinked?: () => void,
   * }}
   */
  let { label = "Spreadsheet link", submitLabel = "Open", layout = "inline", onlinked } = $props();

  const id = $props.id();
  let url = $state("");
  let busy = $state(false);

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy || !url.trim()) return;
    busy = true;
    const linked = await attempt(async () => {
      await workspace.addLink(url);
      return true;
    }, "Could not open spreadsheet");
    busy = false;
    if (linked) {
      url = "";
      onlinked?.();
    }
  }
</script>

<form class={["form", layout]} onsubmit={submit}>
  <label for={id} class="field-label">{label}</label>
  <div class="row">
    <!-- type="text" so a bare spreadsheet ID is accepted as well as a full link. -->
    <input
      {id}
      class="input"
      type="text"
      inputmode="url"
      autocomplete="off"
      spellcheck="false"
      placeholder="https://docs.google.com/spreadsheets/d/…"
      bind:value={url}
      disabled={busy}
    />
    <Button type="submit" variant="primary" {busy} disabled={!url.trim() || !auth.connected} title={auth.connected ? undefined : "Connect Google first"}>
      {submitLabel}
    </Button>
  </div>
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    display: flex;
    gap: 12px;
  }

  .stacked .row {
    flex-direction: column;
    gap: 10px;
  }

  .stacked .input,
  .stacked .row :global(.button) {
    min-height: 48px;
  }

  @media (max-width: 700px) {
    .row {
      flex-direction: column;
    }
  }
</style>
