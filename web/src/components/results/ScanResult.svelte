<script>
  import { formatTime, pluralize } from "$lib/format.js";
  import { enter } from "$lib/motion.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
  import DetailsList from "./DetailsList.svelte";
  import FieldList from "./FieldList.svelte";
  import PayloadBlock from "./PayloadBlock.svelte";
  import RecordingStatus from "./RecordingStatus.svelte";

  /**
   * `compact` (the mobile scanner) shows the value and at most three key fields, with
   * everything else one tap away, so the camera and result fit on one screen.
   * @type {{ scan: import("$lib/stores/session.svelte.js").Scan, compact?: boolean }}
   */
  let { scan, compact = false } = $props();

  /** Metadata every scan has; compact mode highlights what the payload itself contains. */
  const METADATA_KEYS = new Set(["raw", "format", "contentType", "byteSize", "scannedAt"]);
  const COMPACT_LIMIT = 3;

  let showAll = $state(false);

  const analysis = $derived(scan.analysis);
  const mapped = $derived(workspace.mappedCount > 0);
  const selectedFields = $derived(analysis.fields.filter((field) => workspace.mappedKeys.has(field.key)));
  /** With columns mapped, the result focuses on the fields that will be written. */
  const focused = $derived(mapped && !showAll);
  const highlights = $derived((mapped ? selectedFields : analysis.fields.filter((field) => !METADATA_KEYS.has(field.key))).slice(0, COMPACT_LIMIT));
  const details = $derived(
    /** @type {Array<[string, string]>} */ ([
      ["Content", analysis.contentType],
      ["Size", pluralize(scan.bytes, "byte")],
      ["Source", scan.source],
      ...analysis.details,
      ...(scan.angle ? [["Rotation", `${Math.round(scan.angle)}°`]] : []),
    ]),
  );
</script>

<article class={["result", compact && "compact"]} aria-label="Latest scan" {@attach enter({ y: 10, duration: 0.35, ease: "power2.out" })}>
  <header>
    <h3>{scan.format}</h3>
    <span class="muted">{analysis.contentType} · {formatTime(scan.time)}</span>
  </header>

  {#if compact}
    <PayloadBlock text={scan.text} link={analysis.link} clamp={!showAll} />
    {#if showAll}
      <div class="fields-heading">
        <h4>Fields</h4>
        <span class="muted">{pluralize(analysis.fields.length, "field")}</span>
      </div>
      <FieldList fields={analysis.fields} emptyMessage="" />
      <h4 class="details-heading">Details</h4>
      <DetailsList rows={details} />
      <Button variant="quiet" class="toggle" onclick={() => (showAll = false)}>Show less</Button>
    {:else}
      {#if highlights.length}
        <div class="highlights"><FieldList fields={highlights} emptyMessage="" dense /></div>
      {/if}
      <Button variant="quiet" class="toggle" onclick={() => (showAll = true)}>Show all {pluralize(analysis.fields.length, "field")} and details</Button>
    {/if}
  {:else}
    {#if !focused}
      <PayloadBlock text={scan.text} link={analysis.link} />
    {/if}

    <RecordingStatus />

    <div class="fields-heading">
      <h4>{focused ? "Mapped fields" : "Fields"}</h4>
      <span class="muted">{focused ? `${selectedFields.length} in this scan` : pluralize(analysis.fields.length, "field")}</span>
    </div>
    <FieldList fields={focused ? selectedFields : analysis.fields} emptyMessage="This barcode contains none of the mapped fields." />

    {#if focused}
      <Button variant="quiet" class="toggle" onclick={() => (showAll = true)}>Show everything in this scan</Button>
    {:else}
      <h4 class="details-heading">Details</h4>
      <DetailsList rows={details} />
      {#if mapped}
        <Button variant="quiet" class="toggle" onclick={() => (showAll = false)}>Show mapped fields only</Button>
      {/if}
    {/if}
  {/if}
</article>

<style>
  .result {
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 14px;
  }

  h3 {
    font-size: 22px;
    overflow-wrap: anywhere;
  }

  header span {
    font-size: 14px;
  }

  .fields-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin: 20px 0 8px;
  }

  h4 {
    font-size: 15px;
  }

  .fields-heading span {
    font-size: 13px;
  }

  .details-heading {
    margin: 20px 0 8px;
  }

  .result :global(.toggle) {
    margin-top: 10px;
  }

  .highlights {
    margin-top: 12px;
  }

  .compact {
    padding: 14px 16px 10px;
  }

  .compact header {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .compact h3 {
    font-size: 19px;
  }

  .compact header span {
    font-size: 13px;
    text-align: right;
  }

  @media (max-width: 700px) {
    .result {
      padding: 16px;
    }
  }
</style>
