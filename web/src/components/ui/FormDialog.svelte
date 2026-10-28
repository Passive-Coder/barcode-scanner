<script>
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import EditorForm from "./EditorForm.svelte";
  import Modal from "./Modal.svelte";

  const request = $derived(dialogs.form);
  let busy = $state(false);
</script>

<Modal
  open={Boolean(request)}
  onclose={() => dialogs.settleForm(false)}
  title={request?.title ?? ""}
  size="wide"
  dismissible={!busy}
>
  {#if request}
    <!-- Remount per request so the inputs start from that request's values. -->
    {#key request}
      <EditorForm {request} bind:busy />
    {/key}
  {/if}
</Modal>
