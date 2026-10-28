<script>
  import { untrack } from "svelte";
  import { errorMessage } from "$lib/format.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import Button from "./Button.svelte";
  import DialogActions from "./DialogActions.svelte";

  /**
   * @type {{
   *   request: import("$lib/stores/dialogs.svelte.js").FormOptions,
   *   busy: boolean,
   * }}
   */
  let { request, busy = $bindable() } = $props();

  const formId = $props.id();
  let values = $state(untrack(() => request.fields.map((field) => field.value ?? "")));
  let error = $state("");

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error = "";
    try {
      await request.onSubmit(values);
      dialogs.settleForm(true);
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      busy = false;
    }
  }

  /** @type {import("svelte/attachments").Attachment<HTMLInputElement>} */
  const focusFirst = (input) => {
    if (input.dataset.index === "0") requestAnimationFrame(() => input.select());
  };
</script>

<form onsubmit={submit} aria-describedby={request.description ? `${formId}-description` : undefined}>
  {#if request.description}<p id="{formId}-description" class="description">{request.description}</p>{/if}
  <div class="fields">
    {#each request.fields as field, index (index)}
      <label class="field">
        <span>{field.label}</span>
        <input class="input" type="text" data-index={index} placeholder={field.placeholder} bind:value={values[index]} disabled={busy} {@attach focusFirst} />
      </label>
    {/each}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <DialogActions>
    <Button onclick={() => dialogs.settleForm(false)} disabled={busy}>Cancel</Button>
    <Button type="submit" variant="primary" {busy}>{busy ? "Saving…" : (request.submitLabel ?? "Save changes")}</Button>
  </DialogActions>
</form>

<style>
  .description {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.55;
    opacity: 0.85;
  }

  .fields {
    display: grid;
    gap: 14px;
    margin-top: 20px;
    max-height: min(55vh, 520px);
    overflow: auto;
    padding: 2px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field span {
    font-size: 13px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .error {
    margin: 16px 0 0;
    padding: 10px 12px;
    border-left: 3px solid var(--danger);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    font-size: 13px;
    line-height: 1.45;
  }
</style>
