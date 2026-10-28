<script>
  /** @type {{ rows: Array<[string, string]> }} */
  let { rows } = $props();
</script>

<dl class="details">
  {#each rows as [label, value], index (index)}
    <div class="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  {/each}
</dl>

<style>
  .details {
    margin: 0;
    border-top: 1px solid var(--line);
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }

  dt {
    font-size: 14px;
    color: var(--ink-muted);
  }

  dd {
    max-width: 70%;
    margin: 0;
    font-size: 14px;
    text-align: right;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }
</style>
