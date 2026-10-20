<script>
  import { untrack } from "svelte";
  import { morphLogo } from "$lib/logo-morph.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import CouncilMark from "../../components/brand/CouncilMark.svelte";
  import LogoMenu from "./LogoMenu.svelte";

  /**
   * The logo in the top-right corner of every signed-in mobile screen. It stays mounted across
   * screens so it can morph: the council mark at home, a barcode inside the scanner. As a mark
   * it opens the account dialog; as a barcode it opens the scanner menu.
   * @type {{ style: "mark" | "barcode", hidden?: boolean }}
   */
  let { style, hidden = false } = $props();

  /** @type {HTMLButtonElement | undefined} */
  let button = $state();
  let menuOpen = $state(false);
  let settled = false;

  // Bars of the barcode form, in viewBox units: [x, width, height].
  const BARS = [
    [-35, 3, 66],
    [-28, 6, 58],
    [-18, 3, 58],
    [-11, 5, 58],
    [-2, 4, 66],
    [6, 7, 58],
    [17, 3, 58],
    [24, 5, 58],
    [33, 3, 66],
  ];

  $effect(() => {
    const next = style;
    if (!button) return;
    const target = button;
    untrack(() => {
      // The first render jumps straight to the right form; later changes animate.
      morphLogo(target, next, { animate: settled });
      settled = true;
      if (next !== "barcode") menuOpen = false;
    });
  });

  function onclick() {
    if (style === "barcode") menuOpen = !menuOpen;
    else dialogs.accountOpen = true;
  }
</script>

<button
  bind:this={button}
  class={["logo", style, hidden && "hidden"]}
  type="button"
  aria-label={style === "barcode" ? "Scanner menu" : "Account"}
  aria-haspopup={style === "barcode" ? "menu" : "dialog"}
  aria-expanded={style === "barcode" ? menuOpen : undefined}
  data-reveal-target
  {onclick}
>
  <CouncilMark />
  <svg class="barcode-glyph" viewBox="-52 -52 104 104" aria-hidden="true">
    {#each BARS as [x, width, height], index (index)}
      <rect class="bar" {x} y={-height / 2} {width} {height} rx="1" />
    {/each}
    <rect class="sweep" x="-42" y="-34" width="84" height="2.5" rx="1.25" />
  </svg>
</button>

<LogoMenu bind:open={menuOpen} anchor={button} />

<style>
  /* Pinned to the same spot as each screen's top bar, aligned with the 560px content column. */
  .logo {
    position: fixed;
    top: calc(var(--safe-top) + 13px);
    right: calc(max(0px, (100vw - 560px) / 2) + 20px);
    z-index: 20;
    width: 46px;
    height: 46px;
    padding: 6px;
    border: 1px solid var(--line-strong);
    border-radius: 23px;
    background: var(--bg);
    color: var(--ink);
    transition: background 0.2s;
  }

  .logo:hover,
  .logo:active {
    background: var(--surface-hover);
  }

  .logo.barcode {
    background: var(--surface);
  }

  .logo.hidden {
    opacity: 0;
  }

  .logo :global(.council-mark),
  .barcode-glyph {
    position: absolute;
    inset: 6px;
    width: calc(100% - 12px);
    height: calc(100% - 12px);
  }

  .bar {
    fill: currentColor;
    opacity: 0;
  }

  .sweep {
    fill: #ffb39e;
    opacity: 0;
  }
</style>
