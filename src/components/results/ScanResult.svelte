<script>
  import { formatTime, pluralize } from "$lib/format.js";
  import { enter } from "$lib/motion.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import Button from "../ui/Button.svelte";
  import DetailsList from "./DetailsList.svelte";
  import FieldList from "./FieldList.svelte";
  import PayloadBlock from "./PayloadBlock.svelte";
  import RecordingStatus from "./RecordingStatus.svelte";

  /** @type {{ scan: import("$lib/stores/session.svelte.js").Scan }} */
  let { scan } = $props();

  let showAll = $state(false);

  const analysis = $derived(scan.analysis);
  const mapped = $derived(workspace.mappedCount > 0);
  const selectedFields = $derived(analysis.fields.filter((field) => workspace.mappedKeys.has(field.key)));
  /** With columns mapped, the result focuses on the fields that will be written. */
  const focused = $derived(mapped && !showAll);
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

<article class="result" aria-label="Latest scan" {@attach enter({ y: 10, duration: 0.35, ease: "power2.out" })}>
  <header>
    <h3>{scan.format}</h3>
    <span class="muted">{analysis.contentType} · {formatTime(scan.time)}</span>
  </header>

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

  @media (max-width: 700px) {
    .result {
      padding: 16px;
    }
  }
</style>
