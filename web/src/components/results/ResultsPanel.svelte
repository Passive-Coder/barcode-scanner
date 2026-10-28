<script>
  import { session } from "$lib/stores/session.svelte.js";
  import ResultEmpty from "./ResultEmpty.svelte";
  import ScanResult from "./ScanResult.svelte";

  /** @type {{ compact?: boolean }} */
  let { compact = false } = $props();
</script>

<div class={["area", compact && "compact"]}>
  {#if session.selected}
    <!-- Keyed so each newly selected scan animates in; mapping changes update in place. -->
    {#key session.selected.id}
      <ScanResult scan={session.selected} {compact} />
    {/key}
  {:else}
    <ResultEmpty {compact} />
  {/if}
</div>

<style>
  .area {
    min-height: 300px;
  }

  @media (max-width: 1000px) {
    .area {
      min-height: 200px;
    }
  }

  .area.compact {
    min-height: 0;
  }
</style>
