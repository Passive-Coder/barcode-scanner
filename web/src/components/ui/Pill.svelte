<script>
  /**
   * A small label, such as a role or a status.
   * @type {{ tone?: "default" | "accent" | "warning" | "danger" | "success", children: import("svelte").Snippet }}
   */
  let { tone = "default", children } = $props();
</script>

<span class={["pill", tone]}>{@render children()}</span>

<style>
  /* Long labels (such as a sub-team's name) wrap inside the pill instead of running past it. */
  .pill {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 13%, transparent);
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .accent {
    background: var(--accent);
    color: var(--on-accent);
  }

  .warning {
    background: color-mix(in srgb, #c98a1c 26%, transparent);
  }

  .danger {
    background: color-mix(in srgb, var(--danger) 22%, transparent);
  }

  .success {
    background: color-mix(in srgb, var(--success) 22%, transparent);
  }
</style>
