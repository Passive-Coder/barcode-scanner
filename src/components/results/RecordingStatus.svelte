<script>
  import { formatTime } from "$lib/format.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";

  const tone = $derived(workspace.pendingSaves ? "saving" : workspace.recording.active ? "active" : "idle");
</script>

<!-- Tells the person whether scans are reaching their sheet, instead of failing silently. -->
<div class={["recording", tone]} role="status">
  <span class="dot" aria-hidden="true"></span>
  <span class="text">
    {#if workspace.pendingSaves}
      Saving to Google Sheets…
    {:else}
      {workspace.recording.reason}
    {/if}
    {#if workspace.lastSave && !workspace.pendingSaves}
      <span class={["last", !workspace.lastSave.ok && "failed"]}>
        {workspace.lastSave.ok ? "Last saved" : "Last save failed"} at {formatTime(workspace.lastSave.at)}.
      </span>
    {/if}
  </span>
</div>

<style>
  .recording {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink-muted);
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--line-strong);
    transform: translateY(-1px);
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

  .last {
    display: block;
    color: var(--ink-muted);
  }

  .last.failed {
    color: var(--danger);
  }

  @keyframes pulse {
    to {
      opacity: 0.3;
    }
  }
</style>
