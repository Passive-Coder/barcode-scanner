<script>
  import { enter } from "$lib/motion.js";

  /** @type {{ fields: import("$lib/barcode/fields.js").ScanField[], emptyMessage: string }} */
  let { fields, emptyMessage } = $props();
</script>

{#if fields.length}
  <dl class="list" {@attach enter({ x: 10, y: 0, duration: 0.4, stagger: 0.035, children: true, ease: "power2.out" })}>
    {#each fields as field (field.key)}
      <div class="row">
        <dt>
          <strong>{field.label}</strong>
          <code>{field.key}</code>
        </dt>
        <dd class="type"><span>{field.type}</span></dd>
        <dd class="value">{field.value || "—"}</dd>
      </div>
    {/each}
  </dl>
{:else}
  <p class="empty-note list">{emptyMessage}</p>
{/if}

<style>
  .list {
    margin: 0;
    border-top: 1px solid var(--line);
  }

  .row {
    display: grid;
    grid-template-columns: minmax(95px, 1fr) auto minmax(110px, 1.2fr);
    align-items: start;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }

  dt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  dd {
    margin: 0;
  }

  strong {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .type span {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-sunk);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  :global([data-layout="mobile"]) .type span {
    background: #4a0714;
  }

  .value {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.4;
    text-align: right;
    color: var(--ink-strong);
    overflow-wrap: anywhere;
  }

  @media (max-width: 700px) {
    .row {
      grid-template-columns: minmax(70px, 1fr) auto;
      gap: 6px;
    }

    .value {
      grid-column: 1 / -1;
      text-align: left;
    }
  }
</style>
