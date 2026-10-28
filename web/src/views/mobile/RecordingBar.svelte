<script>
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";

  const tone = $derived(workspace.pendingSaves ? "saving" : workspace.recording.active ? "active" : "idle");
  const text = $derived(workspace.pendingSaves ? "Saving to Google Sheets…" : workspace.recording.reason);
</script>

<!-- One line on the scanner saying where scans go, with the way to change it. -->
<div class={["recording", tone]} role="status">
  <span class="dot" aria-hidden="true"></span>
  <span class="text">{text}</span>
  <button type="button" onclick={() => mobileNav.go("sheet-settings")}>Sheet settings</button>
</div>

<style>
  .recording {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0;
    padding: 8px 8px 8px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-size: 13px;
    line-height: 1.35;
    color: var(--ink-muted);
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--line-strong);
  }

  .active .dot {
    background: var(--success);
  }

  .saving .dot {
    background: var(--accent);
    animation: pulse 1s ease-in-out infinite alternate;
  }

  .active .text {
    color: var(--ink);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  button {
    flex: none;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--secondary-border);
    border-radius: var(--radius-sm);
    background: var(--secondary-bg);
    color: var(--ink-strong);
    font-size: 13px;
    font-weight: 600;
  }

  @keyframes pulse {
    to {
      opacity: 0.3;
    }
  }
</style>
