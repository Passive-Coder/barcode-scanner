<script>
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";

  /** @type {{ text: string, link: string | null }} */
  let { text, link } = $props();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.show("Copied to clipboard");
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  }
</script>

<div class="payload">
  <div class="value">{text || "(empty payload)"}</div>
  <div class="actions">
    <Button variant="quiet" onclick={copy}>Copy</Button>
    <!-- `link` is only ever an http(s) URL parsed by analyzeScan, never javascript: or data:. -->
    {#if link}
      <a class="link" href={link} target="_blank" rel="noopener noreferrer">Open link</a>
    {/if}
  </div>
</div>

<style>
  .payload {
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-sunk);
  }

  .value {
    max-height: 160px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 15px;
    line-height: 1.5;
    color: var(--ink-strong);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 4px;
  }

  .link {
    color: var(--link);
    font-size: 13px;
    font-weight: 600;
  }

  .link:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  :global([data-layout="mobile"]) .payload {
    background: #4a0714;
  }
</style>
