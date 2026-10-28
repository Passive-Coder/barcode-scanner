<script>
  import { toast } from "$lib/stores/toast.svelte.js";
</script>

<!-- Always rendered so screen readers register the live region before the first message. -->
<div class={["toast", toast.tone, toast.visible && "visible"]} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}>
  {#if toast.visible}
    <span>{toast.message}</span>
    <button type="button" aria-label="Dismiss notification" onclick={() => toast.dismiss()}>×</button>
  {/if}
</div>

<style>
  .toast {
    position: fixed;
    right: 24px;
    bottom: calc(24px + var(--safe-bottom));
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: min(420px, calc(100vw - 48px));
    padding: 12px 12px 12px 18px;
    border-radius: var(--radius);
    background: var(--toast-bg);
    color: var(--toast-ink);
    box-shadow: 0 12px 32px #28050e40;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    opacity: 0;
    transform: translateY(12px);
    pointer-events: none;
    transition: opacity 0.2s, transform 0.2s;
  }

  .toast.error {
    background: var(--toast-error-bg);
  }

  .toast.visible {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  span {
    flex: 1;
  }

  button {
    flex: none;
    width: 28px;
    height: 28px;
    border: 0;
    background: none;
    color: inherit;
    font-size: 20px;
    line-height: 1;
    opacity: 0.75;
  }

  @media (max-width: 700px) {
    .toast {
      right: 18px;
      left: 18px;
      bottom: calc(18px + var(--safe-bottom));
      max-width: none;
      text-align: center;
    }
  }
</style>
