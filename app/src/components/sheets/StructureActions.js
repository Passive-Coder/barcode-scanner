import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { addTab, deleteTab, renameTab } from "../../lib/sheet-actions.js";
import { useStore } from "../../lib/store.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";

/** Tab actions for the open spreadsheet, and the change log. */
export function StructureActions() {
  useStore(workspace);
  if (!workspace.activeId) return null;
  const disabled = !workspace.canEdit;
  return (
    <View style={styles.actions}>
      <Button variant="quiet" label="Change log" onPress={() => router.push("/changes")} />
      <Button variant="quiet" label="Add tab" disabled={disabled} onPress={() => addTab()} />
      <Button variant="quiet" label="Rename tab" disabled={disabled || !workspace.tab} onPress={() => renameTab()} />
      <Button variant="quiet" label="Delete tab" disabled={disabled || !workspace.tab} onPress={() => deleteTab()} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
  },
});
