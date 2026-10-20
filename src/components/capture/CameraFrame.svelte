<script>
  import { camera } from "$lib/stores/camera.svelte.js";

  /** @type {HTMLDivElement | undefined} */
  let view = $state();

  $effect(() => {
    camera.attach(view ?? null);
    camera.warmUp();
    return () => {
      // Leaving the screen or tab always releases the camera.
      camera.stop();
      camera.attach(null);
    };
  });

  // While live, the frame takes the feed's own shape, so the whole camera image is visible
  // and nothing is cropped away; the scanner decodes that entire image too.
  const liveRatio = $derived(camera.live && camera.aspectRatio ? camera.aspectRatio : null);
  // A tall feed is narrowed rather than letterboxed, so it keeps its shape within the height cap.
  const liveWidth = $derived(liveRatio ? `min(100%, calc(72svh * ${liveRatio}))` : undefined);
</script>

<div class={["frame", camera.live && "live"]} style:aspect-ratio={liveRatio ? String(liveRatio) : undefined} style:width={liveWidth}>
  <div class="view" bind:this={view}></div>
  {#if !camera.live}
    <div class="empty">
      <strong>Camera is off</strong>
      <span>Start the camera and hold a barcode anywhere in view.</span>
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    aspect-ratio: 16 / 10;
    max-height: 72svh;
    margin: 0 auto;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--camera-bg);
    color: var(--camera-ink);
  }

  .view {
    position: absolute;
    inset: 0;
  }

  /* `contain`, never `cover`: the full camera image is shown, letterboxed if space is tight. */
  .view > :global(video) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Only the placeholder has a minimum height; a live frame always keeps the feed's shape. */
  .frame:not(.live) {
    min-height: 220px;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 24px;
    text-align: center;
  }

  .empty strong {
    font-size: 17px;
    font-weight: 600;
  }

  .empty span {
    font-size: 14px;
    color: var(--camera-muted);
  }

  @media (max-width: 700px) {
    .frame:not(.live) {
      aspect-ratio: 4 / 5;
      min-height: 0;
      max-height: 62svh;
    }
  }
</style>
