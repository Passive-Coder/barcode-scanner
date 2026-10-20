<script>
  /**
   * A small label, such as a role or a status.
   * @type {{ tone?: "default" | "accent" | "warning" | "danger" | "success", children: import("svelte").Snippet }}
   */
  let { tone = "default", children } = $props();
</script>

<span class={["pill", tone]}>{@render children()}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 13%, transparent);
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
    white-space: nowrap;
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
