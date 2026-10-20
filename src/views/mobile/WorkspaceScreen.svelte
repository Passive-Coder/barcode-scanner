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
  import MobileBar from "./MobileBar.svelte";
  import RecordingBar from "./RecordingBar.svelte";

  const scanning = $derived(mobileNav.intent === "scan");
</script>

<div class="screen">
  <MobileBar
    title={workspace.title || "Spreadsheet"}
    subtitle={scanning ? "Scanning" : "Editing"}
    backLabel="Back to spreadsheets"
    onback={() => mobileNav.go("choose")}
  />

  <main {@attach enter({ y: 12, duration: 0.4, stagger: 0.05, children: true })}>
    <SessionBanner />

    {#if scanning}
      <!-- Just the camera and the latest scan; where scans go lives on the Sheet settings page.
           Leaving this screen unmounts the camera, which turns it off. -->
      <h2 class="visually-hidden">Scan</h2>
      <CapturePanel />
      <RecordingBar />
      <h2 class="visually-hidden">Latest scan</h2>
      <ResultsPanel compact />
    {:else}
      <section aria-labelledby="mobile-sheet-heading">
        <SectionHeading title="Spreadsheet" id="mobile-sheet-heading" />
        <SheetPicker />
        <!-- Column mapping is part of scanning, so it lives on the Sheet settings page. -->
        <SheetEditor showMapping={false} />
      </section>
    {/if}
  </main>
</div>

<style>
  .screen {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 20px calc(32px + var(--safe-bottom));
  }

  main > :global(.banner) {
    margin-bottom: 16px;
  }
</style>
