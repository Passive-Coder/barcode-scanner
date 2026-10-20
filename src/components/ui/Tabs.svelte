<script>
  /**
   * A row of tabs that switches what's shown below it. Arrow keys move between tabs.
   * @type {{
   *   value: string,
   *   options: Array<{ value: string, label: string, count?: number }>,
   *   label: string,
   * }}
   */
  let { value = $bindable(), options, label } = $props();

  /** @param {KeyboardEvent} event */
  function onkeydown(event) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
    value = next.value;
    const buttons = /** @type {HTMLElement} */ (event.currentTarget).querySelectorAll("button");
    /** @type {HTMLElement | undefined} */ (buttons[options.indexOf(next)])?.focus();
    event.preventDefault();
  }
</script>

<div class="tabs" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="tab"
      aria-selected={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      class={{ active: option.value === value }}
      onclick={() => (value = option.value)}
    >
      {option.label}
      {#if option.count}<span class="count">{option.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid var(--line);
    scrollbar-width: none;
  }

  button {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 42px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 600;
  }

  button:hover {
    color: var(--ink-strong);
  }

  .active {
    border-bottom-color: var(--accent);
    color: var(--ink-strong);
  }

  .count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 13%, transparent);
    font-size: 12px;
    text-align: center;
  }
</style>
