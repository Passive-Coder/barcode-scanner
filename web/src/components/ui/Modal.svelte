<script>
  /**
   * Accessible modal built on <dialog>: focus is trapped by the browser, Escape and a backdrop
   * click both call `onclose`, and the parent stays in control of `open`.
   * @typedef {object} Props
   * @property {boolean} open
   * @property {() => void} onclose
   * @property {string} [title]
   * @property {"default" | "wide" | "compact"} [size]
   * @property {boolean} [dismissible] false while work is in progress
   * @property {import("svelte").Snippet} [header] replaces the default title row
   * @property {import("svelte").Snippet} children
   */

  /** @type {Props} */
  let { open, onclose, title = "", size = "default", dismissible = true, header, children } = $props();

  const titleId = $props.id();
  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function requestClose() {
    if (dismissible) onclose();
  }
</script>

<!-- Escape is handled by the dialog's cancel event; the click handler only catches backdrop clicks. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class={["modal", size]}
  aria-labelledby={title ? titleId : undefined}
  oncancel={(event) => {
    event.preventDefault();
    requestClose();
  }}
  onclick={(event) => {
    if (event.target === dialog) requestClose();
  }}
>
  {#if open}
    <div class="body">
      {#if header}
        {@render header()}
      {:else}
        <div class="top">
          <h2 id={titleId}>{title}</h2>
          <button class="close" type="button" aria-label="Close" disabled={!dismissible} onclick={requestClose}>×</button>
        </div>
      {/if}
      {@render children()}
    </div>
  {/if}
</dialog>

<style>
  .modal {
    width: min(500px, calc(100vw - 32px));
    max-height: min(90vh, 820px);
    max-height: min(90svh, 820px);
    padding: 0;
    overflow: auto;
    border: 1px solid var(--dialog-line);
    border-radius: var(--radius);
    background: var(--dialog-bg);
    color: var(--dialog-ink);
    box-shadow: 0 24px 64px #2503094d;
  }

  .modal.wide {
    width: min(580px, calc(100vw - 32px));
  }

  .modal.compact {
    width: min(400px, calc(100vw - 32px));
  }

  .modal::backdrop {
    background: var(--backdrop);
  }

  .body {
    padding: 24px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 16px;
  }

  h2 {
    font-size: 20px;
    color: var(--dialog-ink);
  }

  .close {
    width: 32px;
    height: 32px;
    flex: none;
    margin: -6px -6px 0 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--dialog-ink);
    font-size: 24px;
    line-height: 1;
  }

  .close:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  @media (max-width: 480px) {
    .body {
      padding: 20px;
    }
  }
</style>
