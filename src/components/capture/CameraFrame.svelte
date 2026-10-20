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
</script>

<div class={["frame", camera.live && "live"]}>
  <div class="view" bind:this={view}></div>
  {#if camera.live}
    <div class="target" aria-hidden="true"></div>
  {:else}
    <div class="empty">
      <strong>Camera is off</strong>
      <span>Start the camera and hold a barcode in view.</span>
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    aspect-ratio: 16 / 10;
    min-height: 260px;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--camera-bg);
    color: var(--camera-ink);
  }

  .view {
    position: absolute;
    inset: 0;
  }

  .view > :global(video) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* A plain aiming box; the whole frame is decoded, so this is guidance only. */
  .target {
    position: absolute;
    inset: 22% 18%;
    border: 2px solid #fff4e6cc;
    border-radius: 12px;
    box-shadow: 0 0 0 100vmax #0000002e;
    pointer-events: none;
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
    .frame {
      aspect-ratio: 4 / 5;
      min-height: 0;
      max-height: 62svh;
    }

    .target {
      inset: 30% 12%;
    }
  }
</style>
