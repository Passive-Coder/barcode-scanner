<script>
  /**
   * @type {{
   *   title: string,
   *   id?: string,
   *   description?: string,
   *   actions?: import("svelte").Snippet,
   * }}
   */
  let { title, id, description = "", actions } = $props();
</script>

<div class="heading">
  <div>
    <h2 {id}>{title}</h2>
    {#if description}<p>{description}</p>{/if}
  </div>
  {#if actions}{@render actions()}{/if}
</div>

<style>
  .heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 20px;
  }

  p {
    max-width: 620px;
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--ink-muted);
  }
</style>
