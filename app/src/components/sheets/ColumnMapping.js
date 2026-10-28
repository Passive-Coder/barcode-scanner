import { StyleSheet, View } from "react-native";
import { addColumn, deleteColumn, renameColumn } from "../../lib/sheet-actions.js";
import { columnLetter } from "../../lib/sheets/values.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { session } from "../../stores/session.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Select } from "../ui/Select.js";
import { Text } from "../ui/Text.js";

/**
 * Columns of the open tab. With `mapping`, each column picks which barcode field it receives
 * when a barcode is scanned; every column can also be renamed or deleted.
 * @param {{ mapping?: boolean }} props
 */
export function ColumnMapping({ mapping = true }) {
  useStore(workspace);
  useStore(session);
  if (!workspace.tab) return null;
  const columns = Array.from({ length: workspace.columnCount }, (_, index) => index);
  const fields = session.availableFields;
  const known = new Set(fields.map((field) => field.key));
  const disabled = !workspace.canEdit;
  return (
    <View style={styles.list}>
      {mapping ? (
        <Text muted>{fields.length ? "Pick the barcode field each column should receive. Every scan adds one row with its mapped values." : "Scan a barcode first: its fields become the choices for each column."}</Text>
      ) : null}
      {columns.length ? null : <Empty text="This tab has no columns yet. Add one to start." />}
      {columns.map((column) => {
        const heading = workspace.headers[column] || `Column ${columnLetter(column)}`;
        const current = workspace.mapping[column] ?? "";
        const options = [
          { value: "", label: "Don't fill from scans" },
          ...fields.map((field) => ({ value: field.key, label: field.label, description: field.value ? `e.g. ${field.value}` : undefined })),
          ...(current && !known.has(current) ? [{ value: current, label: current, description: "Chosen earlier; scan a matching barcode to see its value" }] : []),
        ];
        return (
          <View key={column} style={styles.column}>
            <View style={styles.head}>
              <View style={styles.letter}>
                <Text variant="tiny">{columnLetter(column)}</Text>
              </View>
              <Text weight="semibold" style={styles.flex}>
                {heading}
              </Text>
              <Button variant="quiet" label="Rename" disabled={disabled} accessibilityLabel={`Rename ${heading}`} onPress={() => renameColumn(column)} />
              <Button variant="quiet" label="Delete" disabled={disabled} accessibilityLabel={`Delete ${heading}`} onPress={() => deleteColumn(column)} />
            </View>
            {mapping ? <Select label={`Field for ${heading}`} hideLabel value={current} options={options} onChange={(key) => workspace.setMapping(column, key)} /> : null}
          </View>
        );
      })}
      <Button label="Add column" disabled={disabled} onPress={() => addColumn()} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  column: {
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    columnGap: 14,
  },
  letter: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.small,
    backgroundColor: colors.surfaceSunk,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
