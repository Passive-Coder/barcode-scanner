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
    <h1 {id} title={title}>{title}</h1>
    {#if subtitle}<span title={subtitle}>{subtitle}</span>{/if}
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
    /* Room on the right for the pinned logo (46px) and a gap, and below a title that wraps. */
    padding: var(--safe-top) 78px 6px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* Long titles wrap onto a second line rather than running off the bar. */
  h1,
  span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow-wrap: anywhere;
  }

  h1 {
    font-size: 19px;
    font-weight: 650;
    line-height: 1.2;
  }

  span {
    margin-top: 2px;
    font-size: 13px;
    color: var(--ink-muted);
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
</style>
