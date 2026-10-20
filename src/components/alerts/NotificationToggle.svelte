<script>
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { notifications } from "$lib/stores/notifications.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import Button from "../ui/Button.svelte";

  async function enable() {
    if (await attempt(async () => (await notifications.enable(), true), "Could not turn on notifications")) toast.show("Alerts will now reach this device");
  }

  async function disable() {
    await attempt(() => notifications.disable(), "Could not turn off notifications");
    toast.show("This device won't get alert notifications");
  }
</script>

<div class="toggle">
  <div class="text">
    <strong>Notifications on this device</strong>
    <p>
      {#if !notifications.supported}
        This browser can't receive alerts while Linework is closed. Alerts still appear here while it's open.
      {:else if notifications.needsInstall}
        On iPhone and iPad, add Linework to your Home Screen (Share → Add to Home Screen) and open it from there to get alerts while it's closed.
      {:else if notifications.permission === "denied"}
        Notifications are blocked for this site. Allow them in your browser's site settings to get alerts while Linework is closed.
      {:else if notifications.enabled}
        On. Pages and notices reach this device even when Linework is closed.
      {:else}
        Off. Turn on to get pages and notices even when Linework is closed.
      {/if}
    </p>
  </div>
  {#if notifications.supported && !notifications.needsInstall && notifications.permission !== "denied"}
    {#if notifications.enabled}
      <Button busy={notifications.busy} onclick={disable}>Turn off</Button>
    {:else}
      <Button variant="primary" busy={notifications.busy} disabled={!account.ready} onclick={enable}>Turn on</Button>
    {/if}
  {/if}
</div>

<style>
  .toggle {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    padding: 12px 14px;
    border: 1px solid var(--dialog-line);
    border-radius: var(--radius);
  }

  .text {
    flex: 1 1 260px;
  }

  strong {
    font-size: 14px;
    font-weight: 650;
  }

  p {
    margin: 2px 0 0;
    font-size: 13px;
    opacity: 0.85;
  }
</style>
