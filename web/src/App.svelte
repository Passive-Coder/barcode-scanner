<script>
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { camera } from "$lib/stores/camera.svelte.js";
  import { mobileLayout } from "$lib/stores/layout.svelte.js";
  import AlertOverlay from "./components/alerts/AlertOverlay.svelte";
  import AlertsDialog from "./components/alerts/AlertsDialog.svelte";
  import ChangesDialog from "./components/changes/ChangesDialog.svelte";
  import SettingsDialog from "./components/settings/SettingsDialog.svelte";
  import ConfirmDialog from "./components/ui/ConfirmDialog.svelte";
  import FormDialog from "./components/ui/FormDialog.svelte";
  import Toast from "./components/ui/Toast.svelte";
  import DesktopStudio from "./views/desktop/DesktopStudio.svelte";
  import MobileApp from "./views/mobile/MobileApp.svelte";

  // The theme tokens in app.css switch on this attribute, so dialogs and toasts follow the layout too.
  $effect(() => {
    document.documentElement.dataset.layout = mobileLayout.current ? "mobile" : "desktop";
  });

  onMount(() => {
    auth.preload();
  });
</script>

<!-- Release the camera when the page is hidden for navigation or the back/forward cache. -->
<svelte:window onpagehide={() => camera.stop()} />

{#if mobileLayout.current}
  <MobileApp />
{:else}
  <DesktopStudio />
{/if}

<SettingsDialog />
<AlertsDialog />
<ChangesDialog />
<ConfirmDialog />
<FormDialog />
<Toast />
<!-- Last, so a page shows above every other dialog. -->
<AlertOverlay />
