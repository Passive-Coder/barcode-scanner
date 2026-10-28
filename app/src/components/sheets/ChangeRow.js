import { StyleSheet, View } from "react-native";
import { formatDateTime } from "../../lib/format.js";
import { columnLetter } from "../../lib/sheets/values.js";
import { colors } from "../../lib/theme.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";

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
/** @type {Record<string, { label: string, tone: "default" | "danger" | "success" | "warning" }>} */
const STATUS = {
  applied: { label: "In Google Sheets", tone: "success" },
  pending: { label: "Waiting", tone: "warning" },
  migrating: { label: "Migrating", tone: "warning" },
  conflict: { label: "Needs attention", tone: "danger" },
  discarded: { label: "Discarded", tone: "default" },
};

/** @param {{ column: number, header: string }} cell */
const columnName = (cell) => cell.header || `Column ${columnLetter(cell.column)}`;

/** @param {import("../../stores/changes.js").LoggedChange} change */
function describe(change) {
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
}

/**
 * One entry in the change log: what changed, where, when, and what happened to it.
 * @param {{ change: import("../../stores/changes.js").LoggedChange, actions?: import("react").ReactNode }} props
 */
export function ChangeRow({ change, actions }) {
  const status = STATUS[change.status] ?? { label: change.status, tone: "default" };
  const details = describe(change);
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Text weight="semibold">{KIND_LABELS[change.kind] ?? change.kind}</Text>
        <Pill label={status.label} tone={status.tone} />
      </View>
      <Text variant="small" muted>{`“${change.sheetTitle}” · ${formatDateTime(new Date(change.createdAt))}`}</Text>
      {details ? <Text variant="mono">{details}</Text> : null}
      {change.message ? (
        <Text variant="small" weight="semibold" color={colors.danger}>
          {change.message}
        </Text>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 18,
  },
});
