import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHEET_ROW_LIMIT } from "../../lib/config.js";
import { deleteRow, editRow, viewRow } from "../../lib/sheet-actions.js";
import { rowSummary, visibleRows } from "../../lib/sheets/row-view.js";
import { useStore } from "../../lib/store.js";
import { TOUCH, colors, fonts, radius } from "../../lib/theme.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Select } from "../ui/Select.js";
import { Text } from "../ui/Text.js";

/** Each row is one line of fixed height, so the list only draws the rows on screen. */
const ROW_HEIGHT = 64;
const ROW_GAP = 6;

/** @typedef {import("../../lib/sheets/row-view.js").SheetRow} SheetRow */

/**
 * The open tab's rows as a list that stays quick for thousands of rows: a search across every
 * cell, newest-first order, and one line per row. Tapping a row opens it to edit (or to read,
 * without edit access). `header` scrolls with the list; with `showRows` off, only it is shown.
 * Rows update live as Google Sheets changes.
 * @param {{ header: import("react").ReactNode, showRows: boolean, refreshing?: boolean, onRefresh?: () => void }} props
 */
export function RowList({ header, showRows, refreshing = false, onRefresh }) {
  useStore(workspace);
  useStore(auth);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState(/** @type {"sheet" | "newest"} */ ("sheet"));
  const rows = workspace.rows;
  const shown = useMemo(() => visibleRows(rows, { query, newestFirst: order === "newest" }), [rows, query, order]);
  const dataCount = Math.max(0, rows.length - 1);
  const columns = workspace.columnCount;
  const disabled = !workspace.canEdit;
  const active = showRows && Boolean(workspace.tab);

  const controls = active ? (
    <View style={styles.controls}>
      <View style={styles.heading}>
        <Text variant="subheading" accessibilityRole="header">{`Rows ${dataCount.toLocaleString()}`}</Text>
        {auth.connected && workspace.syncedAt ? (
          <View style={styles.live} accessibilityLabel="Live: changes made in Google Sheets appear here within seconds">
            <View style={styles.liveDot} />
            <Text variant="tiny" muted>
              Live
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="small" muted>
        {`Tap a row to ${disabled ? "see" : "change"} all of it. Changes are saved straight to Google Sheets.${dataCount >= SHEET_ROW_LIMIT - 1 ? ` Only the first ${SHEET_ROW_LIMIT.toLocaleString()} rows are shown.` : ""}`}
      </Text>
      <Button variant="primary" label="Add row" disabled={disabled} onPress={() => editRow(null)} />
      {columns && dataCount ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search rows"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Search rows"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={styles.search}
          />
          <Select
            label="Order"
            hideLabel
            value={order}
            onChange={setOrder}
            options={[
              { value: "sheet", label: "Sheet order" },
              { value: "newest", label: "Newest first" },
            ]}
          />
          {query.trim() ? (
            <Text variant="small" muted accessibilityLiveRegion="polite">{`${shown.length.toLocaleString()} of ${dataCount.toLocaleString()} rows match`}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  ) : null;

  const empty = !active ? null : !columns ? (
    <Empty text="This tab has no columns yet. Add a column, then add rows or scan barcodes into it." />
  ) : !dataCount ? (
    <Empty text="No rows yet. Scan a barcode or add a row." />
  ) : (
    <Empty text={`No rows match “${query.trim()}”.`} />
  );

  return (
    <FlatList
      data={active ? shown : []}
      keyExtractor={(row) => String(row.rowNumber)}
      renderItem={({ item }) => <RowItem row={item} disabled={disabled} />}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT + ROW_GAP, offset: (ROW_HEIGHT + ROW_GAP) * index, index })}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {controls}
        </View>
      }
      ListEmptyComponent={empty}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={14}
      maxToRenderPerBatch={20}
      windowSize={9}
      removeClippedSubviews
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
    />
  );
}

/** One row: its number, first value, and the next few values. @param {{ row: SheetRow, disabled: boolean }} props */
function RowItem({ row, disabled }) {
  const summary = rowSummary(row.cells, workspace.headers);
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Row ${row.rowNumber}: ${summary.title}${summary.detail ? `, ${summary.detail}` : ""}`}
        accessibilityHint={disabled ? "Shows every value in this row" : "Opens this row to edit"}
        onPress={() => (disabled ? viewRow(row.rowNumber) : editRow(row.rowNumber))}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <Text variant="mono" color={colors.paperMuted} style={styles.number}>
          {String(row.rowNumber)}
        </Text>
        <View style={styles.text}>
          <Text weight="semibold" color={colors.paperInk} numberOfLines={1}>
            {summary.title}
          </Text>
          {summary.detail ? (
            <Text variant="small" color={colors.paperMuted} numberOfLines={1}>
              {summary.detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Button variant="quiet" textColor={colors.paperDanger} label="Delete" disabled={disabled} accessibilityLabel={`Delete row ${row.rowNumber}`} onPress={() => deleteRow(row.rowNumber)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
    paddingBottom: 12,
  },
  controls: {
    gap: 10,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  search: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.small,
    backgroundColor: colors.field,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  item: {
    height: ROW_HEIGHT,
    marginBottom: ROW_GAP,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
    borderRadius: radius.medium,
    backgroundColor: colors.paper,
    overflow: "hidden",
  },
  summary: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 12,
  },
  pressed: {
    backgroundColor: colors.paperLine,
  },
  number: {
    minWidth: 34,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
