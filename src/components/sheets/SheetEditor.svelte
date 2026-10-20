<script>
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import ColumnMapping from "./ColumnMapping.svelte";
  import DataTable from "./DataTable.svelte";
  import StructureBar from "./StructureBar.svelte";

  /**
   * The open tab's structure, column mapping, and data. The mobile scan screen shows only
   * the mapping; everywhere else shows all three.
   * @type {{ showStructure?: boolean, showData?: boolean }}
   */
  let { showStructure = true, showData = true } = $props();
</script>

{#if workspace.tab}
  <div class="editor">
    {#if showStructure}<StructureBar />{/if}
    <ColumnMapping />
    {#if showData}<DataTable />{/if}
  </div>
{/if}
