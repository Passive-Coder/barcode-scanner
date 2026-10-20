<script>
  import { attempt } from "$lib/feedback.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import CouncilMark from "../brand/CouncilMark.svelte";
  import Modal from "../ui/Modal.svelte";

  const close = () => (dialogs.accountOpen = false);

  function signOut() {
    close();
    workspace.signOut();
  }

  /** Opens Google's account chooser, for example to sign in as a spreadsheet's owner. */
  function switchAccount() {
    close();
    attempt(() => workspace.connect(), "Could not switch Google account");
  }

  function openSetup() {
    close();
    dialogs.settingsOpen = true;
  }
</script>

<Modal open={dialogs.accountOpen} onclose={close} title="Account" size="compact">
  <div class="identity">
    <div class="mark"><CouncilMark /></div>
    <div>
      <strong>{auth.displayName === "there" ? "Signed in" : auth.displayName}</strong>
      {#if auth.email}<span>{auth.email}</span>{/if}
    </div>
  </div>
  <div class="actions">
    <button type="button" class="secondary wide" onclick={switchAccount}>Switch account</button>
    <button type="button" class="secondary" onclick={openSetup}>Settings</button>
    <button type="button" class="primary" onclick={signOut}>Sign out</button>
  </div>
</Modal>

<style>
  .identity {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 18px 0 22px;
  }

  .mark {
    width: 44px;
    height: 44px;
    flex: none;
    color: var(--ink-muted);
  }

  .identity div:last-child {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  strong {
    font-size: 17px;
    font-weight: 600;
  }

  span {
    font-size: 14px;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .actions button {
    min-height: 46px;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 600;
  }

  .wide {
    grid-column: 1 / -1;
  }

  .secondary {
    border: 1px solid var(--secondary-border);
    background: transparent;
    color: var(--dialog-ink);
  }

  .primary {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
