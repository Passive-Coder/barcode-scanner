<script>
  import SheetEditor from "../../components/sheets/SheetEditor.svelte";
  import SheetLinkForm from "../../components/sheets/SheetLinkForm.svelte";
  import SheetPicker from "../../components/sheets/SheetPicker.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
</script>

<section class="sheets" aria-labelledby="sheets-heading">
  <SectionHeading
    title="Google Sheets"
    id="sheets-heading"
    description="Open a spreadsheet, then choose which barcode field each column receives. Each scan is added as a new row."
  />
  <SheetLinkForm />
  <SheetPicker />
  <SheetEditor />
</section>

<style>
  .sheets {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--line);
  }
</style>
