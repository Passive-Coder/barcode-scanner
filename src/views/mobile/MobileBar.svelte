<script>
  import BackButton from "./BackButton.svelte";

  /**
   * The sticky top bar of the signed-in screens. It keeps the right-hand corner clear for the
   * pinned HeaderLogo, so every screen lines up with it.
   * @type {{ title: string, subtitle?: string, backLabel?: string, onback?: () => void, id?: string }}
   */
  let { title, subtitle = "", backLabel = "Back", onback, id } = $props();
</script>

<header class="bar">
  {#if onback}<BackButton label={backLabel} onclick={onback} />{/if}
  <div class="titles">
    <h1 {id}>{title}</h1>
    {#if subtitle}<span>{subtitle}</span>{/if}
  </div>
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    min-height: calc(72px + var(--safe-top));
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 -20px 20px;
    /* Room on the right for the pinned logo (46px) and a gap. */
    padding: var(--safe-top) 78px 0 20px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  h1 {
    overflow: hidden;
    font-size: 19px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    font-size: 13px;
    color: var(--ink-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
