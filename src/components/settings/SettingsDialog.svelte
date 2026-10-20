<script>
  import { attempt } from "$lib/feedback.js";
  import { errorMessage } from "$lib/format.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { settings } from "$lib/stores/settings.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
  import DialogActions from "../ui/DialogActions.svelte";
  import Modal from "../ui/Modal.svelte";

  const id = $props.id();
  let clientId = $state("");
  let clientIdError = $state("");

  // Refresh the field from current settings each time the dialog opens.
  $effect(() => {
    if (!dialogs.settingsOpen) return;
    clientId = settings.clientId;
    clientIdError = "";
  });

  const close = () => (dialogs.settingsOpen = false);

  /** @param {boolean} changed */
  function afterClientIdChange(changed) {
    if (changed && auth.status !== "signed-out") {
      workspace.signOut();
      toast.show("Client ID saved. Sign in again to use it.");
    } else {
      toast.show("Client ID saved");
    }
    close();
  }

  /** @param {SubmitEvent} event */
  function saveClientId(event) {
    event.preventDefault();
    try {
      afterClientIdChange(settings.saveClientId(clientId));
    } catch (error) {
      clientIdError = errorMessage(error);
    }
  }

  /** Opens Google's account chooser, for example to sign in as a spreadsheet's owner. */
  function switchAccount() {
    close();
    attempt(() => workspace.connect(), "Could not switch Google account");
  }

  function signOut() {
    workspace.signOut();
    close();
    toast.show("Signed out of Google");
  }
</script>

<Modal open={dialogs.settingsOpen} onclose={close} title="Settings">
  {#if auth.status !== "signed-out"}
    <div class="account">
      <span>Signed in{auth.email ? ` as ${auth.email}` : ""}</span>
      <span class="account-actions">
        <Button variant="quiet" onclick={switchAccount}>Switch account</Button>
        <Button variant="quiet" tone="danger" onclick={signOut}>Sign out</Button>
      </span>
    </div>
  {/if}

  <form onsubmit={saveClientId} class="group">
    <label for="{id}-client" class="field-label">Google OAuth client ID</label>
    <p>Sign-in uses this public client ID; no client secret is involved. Change it only if your Google Cloud setup changes.</p>
    <input id="{id}-client" class="input input-mono" type="text" spellcheck="false" autocomplete="off" bind:value={clientId} />
    {#if clientIdError}<p class="error" role="alert">{clientIdError}</p>{/if}
    <DialogActions align="between">
      <Button variant="quiet" disabled={!settings.clientIdOverride} onclick={() => afterClientIdChange(settings.resetClientId())}>Use default</Button>
      <Button type="submit" variant="primary">Save</Button>
    </DialogActions>
  </form>
</Modal>

<style>
  .account {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-sunk);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .account-actions {
    display: flex;
    flex: none;
    gap: 14px;
  }

  .group {
    margin-top: 20px;
  }

  p {
    margin: 4px 0 10px;
    font-size: 14px;
    opacity: 0.85;
  }

  .error {
    margin: 10px 0 0;
    color: var(--danger);
    opacity: 1;
  }
</style>
