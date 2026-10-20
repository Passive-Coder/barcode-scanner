<script>
  import { ribbons } from "$lib/ribbons/ribbon-field.js";

  /** @type {{ position: "top" | "bottom" }} */
  let { position } = $props();

  // The bottom bundle is turned 180° and offset in phase so it never mirrors the top exactly.
  const options = $derived(position === "bottom" ? { mirror: true, seed: 2.4 } : { mirror: false, seed: 0 });
</script>

<div class={["ribbons", position]} aria-hidden="true">
  <canvas {@attach ribbons(options)}></canvas>
</div>

<style>
  /*
   * The bundle is sized to stay inside the canvas on its inner edge; the soft fade there is a
   * safety net, so a strand can never end in a hard, clipped line.
   */
  .ribbons {
    position: absolute;
    left: 0;
    width: 100%;
    height: clamp(150px, 27svh, 280px);
    pointer-events: none;
    z-index: -1;
  }

  .top {
    top: 0;
    -webkit-mask-image: linear-gradient(to bottom, #000 82%, transparent);
    mask-image: linear-gradient(to bottom, #000 82%, transparent);
  }

  .bottom {
    bottom: 0;
    -webkit-mask-image: linear-gradient(to top, #000 82%, transparent);
    mask-image: linear-gradient(to top, #000 82%, transparent);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
