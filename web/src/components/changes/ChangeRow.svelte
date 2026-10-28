<script>
  import { formatDateTime } from "$lib/format.js";
  import { columnLetter } from "$lib/sheets/values.js";

  /**
   * One entry in the change log: what changed, where, when, and what happened to it.
   * @type {{ change: import("$lib/stores/changes.svelte.js").LoggedChange, actions?: import("svelte").Snippet }}
   */
  let { change, actions } = $props();

  const KIND_LABELS = {
    append: "Row added",
    update: "Row edited",
    "delete-row": "Row deleted",
    "add-tab": "Tab added",
    "rename-tab": "Tab renamed",
    "delete-tab": "Tab deleted",
    "add-column": "Column added",
    "rename-column": "Column renamed",
    "delete-column": "Column deleted",
  };
  const STATUS_LABELS = { applied: "In Google Sheets", pending: "Waiting", migrating: "Migrating", conflict: "Needs attention", discarded: "Discarded" };

  /** @param {{ column: number, header: string }} cell */
  const columnName = (cell) => cell.header || `Column ${columnLetter(cell.column)}`;

  const details = $derived.by(() => {
    const payload = change.payload ?? {};
    switch (change.kind) {
      case "append":
        return (payload.cells ?? []).map((/** @type {any} */ cell) => `${columnName(cell)}: ${cell.value}`).join(" · ");
      case "update":
        return (payload.cells ?? []).map((/** @type {any} */ cell) => `${columnName(cell)}: ${cell.before || "(empty)"} → ${cell.after === "" ? "(empty)" : cell.after}`).join(" · ");
      case "delete-row":
        return `Row ${payload.row}: ${(payload.before ?? []).filter(Boolean).join(" · ") || "(empty)"}`;
      case "rename-tab":
        return `${payload.from} → ${payload.to}`;
      case "rename-column":
        return `${payload.from || columnLetter(payload.column)} → ${payload.to}`;
      case "add-column":
      case "delete-column":
        return payload.header || columnLetter(payload.column);
      default:
        return payload.title ?? "";
    }
  });
</script>

<li class="change">
  <div class="main">
    <div class="top">
      <strong>{KIND_LABELS[change.kind] ?? change.kind}</strong>
      <span class={["status", change.status]}>{STATUS_LABELS[change.status] ?? change.status}</span>
    </div>
    <p class="where">“{change.sheetTitle}” · {formatDateTime(new Date(change.createdAt))}</p>
    {#if details}<p class="details">{details}</p>{/if}
    {#if change.message}<p class="message">{change.message}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</li>

<style>
  .change {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--dialog-line);
  }

  .main {
    min-width: 0;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  strong {
    font-size: 15px;
    font-weight: 600;
  }

  .status {
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--dialog-ink) 13%, transparent);
    font-size: 12px;
    font-weight: 600;
  }

  .status.conflict {
    background: color-mix(in srgb, var(--danger) 18%, transparent);
  }

  .status.applied {
    background: color-mix(in srgb, var(--success) 18%, transparent);
  }

  p {
    margin: 2px 0 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .where {
    opacity: 0.75;
  }

  .details {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .message {
    font-weight: 600;
    color: var(--danger);
  }

  .actions {
    display: flex;
    flex: none;
    gap: 14px;
  }
</style>
