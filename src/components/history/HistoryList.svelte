<script>
  import { formatTime } from "$lib/format.js";
  import { session } from "$lib/stores/session.svelte.js";
</script>

{#if session.scans.length}
  <ol class="list">
    {#each session.scans as scan (scan.id)}
      <li>
        <button type="button" class={["item", scan.id === session.selected?.id && "selected"]} aria-current={scan.id === session.selected?.id || undefined} onclick={() => session.select(scan.id)}>
          <span class="format">{scan.format}</span>
          <span class="value">{scan.text || "(empty)"}</span>
          <span class="time">{formatTime(scan.time)}</span>
        </button>
      </li>
    {/each}
  </ol>
{:else}
  <p class="empty-note">Scans from this session will be listed here.</p>
{/if}

<style>
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  .item {
    width: 100%;
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 12px 10px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    color: var(--ink);
    text-align: left;
  }

  .item:hover,
  .item.selected {
    background: var(--surface-hover);
  }

  .format {
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time {
    font-size: 13px;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 700px) {
    .item {
      grid-template-columns: 90px minmax(0, 1fr);
      gap: 10px;
    }

    .time {
      display: none;
    }
  }
</style>
