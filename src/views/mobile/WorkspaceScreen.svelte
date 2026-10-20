<script>
  import { enter } from "$lib/motion.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import CapturePanel from "../../components/capture/CapturePanel.svelte";
  import ResultsPanel from "../../components/results/ResultsPanel.svelte";
  import SheetEditor from "../../components/sheets/SheetEditor.svelte";
  import SheetPicker from "../../components/sheets/SheetPicker.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import BackButton from "./BackButton.svelte";

  const scanning = $derived(mobileNav.intent === "scan");
</script>

<div class="screen">
  <header class="bar" {@attach enter({ y: 14, duration: 0.45 })}>
    <BackButton label="Back to spreadsheets" onclick={() => mobileNav.go("choose")} />
    <div class="titles">
      <h1>{workspace.title || "Spreadsheet"}</h1>
      <span>{scanning ? "Scanning" : "Editing"}</span>
    </div>
    <button class="change" type="button" onclick={() => mobileNav.go("choose")}>Change</button>
  </header>

  <main>
    <SessionBanner />

    {#if scanning}
      <!-- Leaving this screen unmounts the camera, which turns it off. -->
      <section aria-labelledby="mobile-capture-heading">
        <SectionHeading title="Scan" id="mobile-capture-heading" />
        <CapturePanel />
      </section>
      <section aria-labelledby="mobile-results-heading">
        <SectionHeading title="Result" id="mobile-results-heading" />
        <ResultsPanel />
      </section>
      <section aria-labelledby="mobile-mapping-heading">
        <SectionHeading title="Columns" id="mobile-mapping-heading" description="Choose which field each column receives." />
        <SheetPicker />
        <SheetEditor showStructure={false} showData={false} />
      </section>
    {:else}
      <section aria-labelledby="mobile-sheet-heading">
        <SectionHeading title="Spreadsheet" id="mobile-sheet-heading" />
        <SheetPicker />
        <SheetEditor />
      </section>
    {/if}
  </main>
</div>

<style>
  .screen {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 20px calc(56px + var(--safe-bottom));
  }

  .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 -20px 24px;
    padding: calc(12px + var(--safe-top)) 20px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  h1 {
    overflow: hidden;
    font-size: 18px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .titles span {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .change {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--link);
    font-size: 15px;
    font-weight: 600;
  }

  main > :global(.banner) {
    margin-bottom: 24px;
  }

  section + section {
    margin-top: 36px;
  }
</style>
