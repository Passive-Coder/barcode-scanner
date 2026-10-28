<script>
  import { camera } from "$lib/stores/camera.svelte.js";
  import Button from "../ui/Button.svelte";
  import CameraFrame from "./CameraFrame.svelte";

  const startLabel = $derived(camera.live ? "Stop camera" : camera.busy ? "Starting…" : "Start camera");
</script>

<CameraFrame />

<div class="controls">
  <Button variant={camera.live ? "secondary" : "primary"} class="start" busy={camera.busy} onclick={() => camera.toggle()}>
    {startLabel}
  </Button>
  {#if camera.live && camera.torchSupported}
    <Button aria-pressed={camera.torchOn} onclick={() => camera.toggleTorch()}>
      {camera.torchOn ? "Flash on" : "Flash off"}
    </Button>
  {/if}
  {#if camera.live && camera.zoomRange}
    <label class="zoom">
      <span>Zoom</span>
      <input
        type="range"
        min={camera.zoomRange.min}
        max={camera.zoomRange.max}
        step={camera.zoomRange.step}
        value={camera.zoom}
        aria-valuetext="{camera.zoom.toFixed(1)}×"
        oninput={(event) => camera.setZoom(Number(event.currentTarget.value))}
      />
    </label>
  {/if}
  {#if camera.live && camera.cameras.length > 1}
    <select class="select camera-select" aria-label="Camera" value={camera.selectedId} onchange={(event) => camera.selectCamera(event.currentTarget.value)}>
      {#each camera.cameras as device, index (device.deviceId)}
        <option value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
      {/each}
    </select>
  {/if}
</div>
<p class={["hint", camera.hintIsError && "error"]} role="status">{camera.hint}</p>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .controls :global(.start) {
    min-width: 150px;
  }

  .zoom {
    flex: 1 1 180px;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .zoom input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }

  .camera-select {
    width: auto;
    max-width: 240px;
    min-height: 42px;
    font-size: 14px;
  }

  .hint {
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .hint.error {
    color: var(--danger);
  }

  @media (max-width: 700px) {
    .controls :global(.start) {
      flex: 1;
    }
  }
</style>
