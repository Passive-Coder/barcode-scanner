import { router } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { forgetLink } from "../../lib/sheet-actions.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Select } from "../ui/Select.js";
import { Text } from "../ui/Text.js";

/** The open spreadsheet and tab, with refresh and a link to Google Sheets. */
export function SheetPicker() {
  useStore(workspace);
  useStore(auth);
  const disabled = !auth.connected || workspace.loading;
  return (
    <View style={styles.picker}>
      <Select
        label="Spreadsheet"
        value={workspace.activeId}
        placeholder="Choose a spreadsheet"
        disabled={disabled}
        options={workspace.links.map((link) => ({ value: link.id, label: link.title }))}
        onChange={(id) => attempt(() => workspace.open(id), "Could not open spreadsheet")}
      />
      {workspace.tabs.length ? (
        <Select
          label="Tab"
          value={String(workspace.sheetId ?? "")}
          disabled={disabled}
          options={workspace.tabs.map((tab) => ({ value: String(tab.sheetId), label: tab.title }))}
          onChange={(sheetId) => attempt(() => workspace.selectTab(Number(sheetId)), "Could not open the tab")}
        />
      ) : null}
      <Text variant="small" color={workspace.status.error ? colors.danger : colors.inkMuted}>
        {workspace.status.message || (workspace.activeId ? "" : "Choose a spreadsheet, or add one with its link.")}
      </Text>
      <View style={styles.actions}>
        <Button compact label="Refresh" busy={workspace.loading} disabled={!workspace.activeId || !auth.connected} onPress={() => attempt(() => workspace.refresh(), "Could not refresh spreadsheet")} />
        {workspace.activeId ? (
          <Button variant="quiet" label="Open in Google Sheets" onPress={() => Linking.openURL(workspace.metadata?.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${workspace.activeId}/edit`)} />
        ) : null}
        <Button variant="quiet" label="Add or switch" onPress={() => router.push("/sheets")} />
        {workspace.activeId ? <Button variant="quiet" label="Forget link" onPress={() => forgetLink(workspace.activeId)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    columnGap: 16,
  },
});
