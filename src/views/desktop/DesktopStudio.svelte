<script>
  import { session } from "$lib/stores/session.svelte.js";
  import CapturePanel from "../../components/capture/CapturePanel.svelte";
  import HistoryList from "../../components/history/HistoryList.svelte";
  import ResultsPanel from "../../components/results/ResultsPanel.svelte";
  import Button from "../../components/ui/Button.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import SheetsSection from "./SheetsSection.svelte";
  import Topbar from "./Topbar.svelte";
</script>

<div class="shell">
  <Topbar />
  <main class="workspace">
    <SessionBanner />

    <div class="grid">
      <section aria-labelledby="capture-heading">
        <SectionHeading title="Scan" id="capture-heading" description="Use the camera or upload a photo of a barcode." />
        <CapturePanel />
      </section>
      <section aria-labelledby="results-heading">
        <SectionHeading title="Result" id="results-heading" description="The decoded value and every field found in it." />
        <ResultsPanel />
      </section>
    </div>

    <SheetsSection />

    <section class="history" aria-labelledby="history-heading">
      <SectionHeading title="Scan history" id="history-heading">
        {#snippet actions()}
          <Button variant="quiet" disabled={!session.scans.length} onclick={() => session.clear()}>Clear</Button>
        {/snippet}
      </SectionHeading>
      <HistoryList />
    </section>
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    background: var(--bg);
  }

  .workspace {
    width: min(1280px, 100%);
    margin: 0 auto;
    padding: 32px var(--gutter) 72px;
  }

  .workspace > :global(.banner) {
    margin-bottom: 24px;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 32px;
  }

  .history {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--line);
  }

  @media (max-width: 1000px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
