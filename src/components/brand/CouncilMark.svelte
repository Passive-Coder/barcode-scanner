<script>
  /**
   * The Student Council mark: five figures in a pinwheel. One figure is drawn with smooth
   * curves and repeated every 72°, so the mark stays crisp at any size and is exactly
   * symmetric (RevealOverlay relies on that when it turns the mark by one step).
   * @type {{ label?: string, class?: string }}
   */
  let { label = "", class: className = "" } = $props();

  // Traced from the original artwork, centred on the mark's middle by the translate below.
  const BODY =
    "M15,-32 C13.8,-34 12.2,-35.4 10.3,-35.2 C8.2,-35 6.6,-31.4 4,-30.4 C1.6,-29.6 -1.6,-29.6 -3.6,-30.8 " +
    "C-5.6,-32 -7.6,-36.3 -9.7,-36.3 C-12.2,-36.3 -16.3,-31.4 -16.9,-26.5 C-17.6,-20.5 -16.6,-14.6 -13.2,-9.2 " +
    "C-10.6,-5.2 -7.3,-2.6 -4,-1 C-6.8,-6.4 -7.6,-12 -6.6,-16.6 C-5.6,-21.4 -2.2,-25.4 2.4,-27.2 " +
    "C7,-28.8 12.6,-27.8 17,-25 C17.6,-26.6 17,-29.8 15,-32 Z";
  const ANGLES = [0, 72, 144, 216, 288];
</script>

<svg
  class={["council-mark", className]}
  viewBox="-52 -52 104 104"
  role={label ? "img" : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : "true"}
>
  <g class="people" fill="currentColor">
    {#each ANGLES as angle (angle)}
      <g transform="rotate({angle})">
        <g class="figure">
          <g transform="translate(-1 -3.1)">
            <circle cx="0.5" cy="-40.5" r="6.4" />
            <path d={BODY} />
          </g>
        </g>
      </g>
    {/each}
  </g>
</svg>

<style>
  .council-mark {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
</style>
