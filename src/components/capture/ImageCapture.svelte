<script>
  import { MAX_IMAGE_BYTES } from "$lib/config.js";
  import { scanImageFile } from "$lib/scanner/index.js";
  import { describeScannerError } from "$lib/scanner/scan.js";
  import { session } from "$lib/stores/session.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";

  const id = $props.id();
  let busy = $state(false);
  let dragging = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let input = $state();

  /** @param {File | undefined} file */
  async function scanFile(file) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file, such as a JPG or PNG.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Choose an image smaller than 20 MB.");
      return;
    }
    busy = true;
    try {
      const results = await scanImageFile(file);
      if (results.length) session.add(results);
      else toast.show("No barcode found in this image. Try a sharper, closer photo.");
    } catch (error) {
      console.error("Could not read image", error);
      toast.error(describeScannerError(error));
    } finally {
      busy = false;
      if (input) input.value = "";
    }
  }

  /** @param {DragEvent} event */
  function ondrop(event) {
    event.preventDefault();
    dragging = false;
    scanFile(event.dataTransfer?.files?.[0]);
  }
</script>

<div
  class={["drop", dragging && "dragging", busy && "busy"]}
  role="presentation"
  ondragover={(event) => {
    event.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  {ondrop}
>
  <input bind:this={input} {id} class="visually-hidden" type="file" accept="image/*" disabled={busy} onchange={(event) => scanFile(event.currentTarget.files?.[0])} />
  <label for={id}>
    <strong>{busy ? "Reading image…" : "Drop an image here, or choose a file"}</strong>
    <span>JPG, PNG, WebP, GIF or BMP, up to 20 MB</span>
  </label>
</div>
<p class="hint">Images are decoded on this device and never uploaded.</p>

<style>
  .drop {
    aspect-ratio: 16 / 10;
    min-height: 260px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }

  .drop:hover,
  .drop.dragging {
    background: var(--surface-hover);
    border-color: var(--ink-muted);
  }

  .drop:has(input:focus-visible) {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .drop.busy {
    opacity: 0.6;
    pointer-events: none;
  }

  label {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
  }

  strong {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink-strong);
  }

  span {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .hint {
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--ink-muted);
  }

  @media (max-width: 700px) {
    .drop {
      aspect-ratio: 4 / 3;
      min-height: 0;
    }
  }
</style>
