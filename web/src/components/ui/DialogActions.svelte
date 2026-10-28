<script>
  /** @type {{ children: import("svelte").Snippet, align?: "end" | "between" }} */
  let { children, align = "end" } = $props();
</script>

<div class={["actions", align]}>
  {@render children()}
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }

  .end {
    justify-content: flex-end;
  }

  .between {
    justify-content: space-between;
  }
</style>
