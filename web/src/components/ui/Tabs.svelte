<script>
  /**
   * Tabs that switch what's shown below them. Arrow keys move between tabs. In narrow spaces
   * they become a two-column grid, so they never scroll sideways.
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

<!-- The frame is the size container the narrow layout responds to. -->
<div class="tabs-frame">
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
</div>

<style>
  .tabs-frame {
    container-type: inline-size;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    border-bottom: 1px solid var(--line);
  }

  .tabs:focus {
    outline: none;
  }

  button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
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

  @container (max-width: 480px) {
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      border-bottom: 0;
    }

    button {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
    }

    /* An odd one out takes the whole last row. */
    button:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    .active {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--on-accent);
    }

    .active .count {
      background: color-mix(in srgb, var(--on-accent) 18%, transparent);
    }
  }
</style>
