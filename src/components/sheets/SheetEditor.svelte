<script>
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import PendingChanges from "../changes/PendingChanges.svelte";
  import ColumnMapping from "./ColumnMapping.svelte";
  import DataTable from "./DataTable.svelte";
  import StructureBar from "./StructureBar.svelte";
  import ViewOnlyNotice from "./ViewOnlyNotice.svelte";

  /**
   * The open tab's structure, column mapping, and data. Each part can be left out: the mobile
   * Sheet settings page shows only the mapping, and the mobile editor leaves the mapping out.
   * @type {{ showStructure?: boolean, showMapping?: boolean, showData?: boolean }}
   */
  let { showStructure = true, showMapping = true, showData = true } = $props();
</script>

{#if workspace.tab}
  <div class="editor">
    <ViewOnlyNotice />
    <PendingChanges />
    {#if showStructure}<StructureBar />{/if}
    {#if showMapping}<ColumnMapping />{/if}
    {#if showData}<DataTable />{/if}
  </div>
{/if}
