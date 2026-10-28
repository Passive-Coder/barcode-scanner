<script>
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import Button from "./Button.svelte";
  import DialogActions from "./DialogActions.svelte";
  import Modal from "./Modal.svelte";

  const request = $derived(dialogs.confirmation);
</script>

<Modal open={Boolean(request)} onclose={() => dialogs.settleConfirmation(false)} title={request?.title ?? ""} size="compact">
  <p>{request?.message}</p>
  <DialogActions>
    {#if !request?.notice}
      <Button onclick={() => dialogs.settleConfirmation(false)}>Cancel</Button>
    {/if}
    <Button variant="primary" tone={request?.danger ? "danger" : "default"} onclick={() => dialogs.settleConfirmation(true)}>
      {request?.confirmLabel ?? "Confirm"}
    </Button>
  </DialogActions>
</Modal>

<style>
  p {
    margin: 10px 0 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--dialog-ink);
    opacity: 0.85;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
