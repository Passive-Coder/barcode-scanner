<script>
  /**
   * @typedef {object} Props
   * @property {"primary" | "secondary" | "outline" | "quiet" | "icon"} [variant]
   * @property {"default" | "danger"} [tone]
   * @property {boolean} [busy] disables the button and shows a spinner
   * @property {import("svelte").Snippet} children
   */

  /** @type {Props & import("svelte/elements").HTMLButtonAttributes} */
  let { variant = "secondary", tone = "default", busy = false, type = "button", disabled = false, class: className = "", children, ...rest } = $props();
</script>

<button
  {type}
  class={["button", variant, tone === "danger" && "danger", className]}
  disabled={disabled || busy}
  aria-busy={busy || undefined}
  {...rest}
>
  {#if busy}<span class="spinner" aria-hidden="true"></span>{/if}
  {@render children()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.15;
    text-align: left;
    white-space: nowrap;
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }

  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .primary.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--on-danger);
  }

  .secondary {
    background: var(--secondary-bg);
    border-color: var(--secondary-border);
    color: var(--ink-strong);
  }

  .secondary:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .outline {
    min-height: 36px;
    padding: 0 12px;
    border-color: var(--secondary-border);
    color: var(--ink-strong);
    font-size: 13px;
  }

  .outline:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .quiet {
    min-height: 32px;
    padding: 0;
    color: var(--link);
    font-size: 13px;
  }

  .quiet:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .quiet.danger {
    color: var(--danger);
  }

  .icon {
    width: 36px;
    min-height: 36px;
    padding: 0;
    border-color: var(--secondary-border);
    color: var(--ink-strong);
    font-size: 17px;
  }

  .icon:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .spinner {
    width: 13px;
    height: 13px;
    flex: none;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
