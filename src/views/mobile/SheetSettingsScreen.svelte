<script>
  import { enter } from "$lib/motion.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import SheetEditor from "../../components/sheets/SheetEditor.svelte";
  import SheetPicker from "../../components/sheets/SheetPicker.svelte";
  import Button from "../../components/ui/Button.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import MobileBar from "./MobileBar.svelte";
</script>

<!-- Everything about where scans go, moved off the scanner so it fits on one screen. -->
<div class="screen">
  <MobileBar title="Sheet settings" subtitle={workspace.title || "No spreadsheet open"} backLabel="Back to scanner" onback={() => mobileNav.go("workspace")} />

  <main {@attach enter({ y: 12, duration: 0.4, stagger: 0.06, children: true })}>
    <SessionBanner />

    <section aria-labelledby="settings-sheet-heading">
      <SectionHeading title="Spreadsheet" id="settings-sheet-heading" description="Scans are added as rows to this tab." />
      <SheetPicker />
      <Button variant="quiet" onclick={() => mobileNav.go("choose")}>Add or switch spreadsheets</Button>
    </section>

    {#if workspace.tab}
      <section aria-label="Column mapping">
        <SheetEditor showStructure={false} showData={false} />
      </section>
    {:else}
      <p class="empty-note">Open a spreadsheet tab to choose which barcode field each column receives.</p>
    {/if}
  </main>
</div>

<style>
  .screen {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 20px calc(48px + var(--safe-bottom));
  }

  main > :global(.banner) {
    margin-bottom: 20px;
  }

  section + section {
    margin-top: 8px;
  }
</style>
