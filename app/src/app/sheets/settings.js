import { ColumnMapping } from "../../components/sheets/ColumnMapping.js";
import { SheetPicker } from "../../components/sheets/SheetPicker.js";
import { ViewOnlyNotice } from "../../components/sheets/ViewOnlyNotice.js";
import { Empty } from "../../components/ui/Empty.js";
import { Screen } from "../../components/ui/Screen.js";
import { Text } from "../../components/ui/Text.js";
import { useStore } from "../../lib/store.js";
import { workspace } from "../../stores/workspace.js";

/** Everything about where scans go: the spreadsheet, the tab, and each column's barcode field. */
export default function SheetSettings() {
  useStore(workspace);
  return (
    <Screen title="Sheet settings" subtitle={workspace.title || "No spreadsheet open"}>
      <Text muted>Scans are added as rows to this tab.</Text>
      <SheetPicker />
      {workspace.tab ? (
        <>
          <ViewOnlyNotice />
          <Text variant="subheading" accessibilityRole="header">
            Column mapping
          </Text>
          <ColumnMapping />
        </>
      ) : (
        <Empty text="Open a spreadsheet tab to choose which barcode field each column receives." />
      )}
    </Screen>
  );
}
