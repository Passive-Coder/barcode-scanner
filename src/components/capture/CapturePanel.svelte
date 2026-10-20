<script>
  import CameraCapture from "./CameraCapture.svelte";
  import ImageCapture from "./ImageCapture.svelte";

  const id = $props.id();
  const modes = /** @type {const} */ ([
    { key: "camera", label: "Live camera" },
    { key: "image", label: "Image upload" },
  ]);
  /** @type {"camera" | "image"} */
  let mode = $state("camera");
  /** @type {HTMLButtonElement[]} */
  const tabs = $state([]);

  /** Arrow keys move between tabs, following the WAI-ARIA tabs pattern. @param {KeyboardEvent} event @param {number} index */
  function onkeydown(event, index) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + modes.length) % modes.length;
    mode = modes[next].key;
    tabs[next]?.focus();
  }
</script>

<div class="tabs" role="tablist" aria-label="Capture mode">
  {#each modes as item, index (item.key)}
    <button
      bind:this={tabs[index]}
      id="{id}-{item.key}-tab"
      class={["tab", mode === item.key && "active"]}
      type="button"
      role="tab"
      aria-selected={mode === item.key}
      aria-controls="{id}-{item.key}-panel"
      tabindex={mode === item.key ? 0 : -1}
      onclick={() => (mode = item.key)}
      onkeydown={(event) => onkeydown(event, index)}
    >
      {item.label}
    </button>
  {/each}
</div>

<div id="{id}-{mode}-panel" role="tabpanel" aria-labelledby="{id}-{mode}-tab">
  <!-- Leaving the camera tab unmounts CameraCapture, which turns the camera off. -->
  {#if mode === "camera"}
    <CameraCapture />
  {:else}
    <ImageCapture />
  {/if}
</div>

<style>
  .tabs {
    display: inline-flex;
    gap: 2px;
    margin-bottom: 12px;
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--surface-sunk);
  }

  .tab {
    min-height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .tab:hover {
    color: var(--ink-strong);
  }

  .tab.active {
    background: var(--surface);
    color: var(--ink-strong);
    box-shadow: 0 1px 2px #3b1a201f;
  }

  :global([data-layout="mobile"]) .tab.active {
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
