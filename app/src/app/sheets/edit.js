import { useState } from "react";
import { ColumnMapping } from "../../components/sheets/ColumnMapping.js";
import { PendingChanges } from "../../components/sheets/PendingChanges.js";
import { RowList } from "../../components/sheets/RowList.js";
import { SheetPicker } from "../../components/sheets/SheetPicker.js";
import { StructureActions } from "../../components/sheets/StructureActions.js";
import { ViewOnlyNotice } from "../../components/sheets/ViewOnlyNotice.js";
import { Screen } from "../../components/ui/Screen.js";
import { Tabs } from "../../components/ui/Tabs.js";
import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";

/**
 * The spreadsheet editor: tabs, columns, and rows, saved straight to Google Sheets. The whole
 * screen is one list, so even a sheet with thousands of rows scrolls smoothly.
 */
export default function EditSheet() {
  useStore(workspace);
  useStore(auth);
  const [view, setView] = useState("rows");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!workspace.activeId || !auth.connected) return;
    setRefreshing(true);
    await attempt(() => workspace.refresh(), "Could not refresh spreadsheet");
    setRefreshing(false);
  }

  return (
    <Screen title={workspace.title || "Spreadsheet"} subtitle="Editing" scroll={false}>
      <RowList
        showRows={view === "rows"}
        refreshing={refreshing}
        onRefresh={refresh}
        header={
          <>
            <SheetPicker />
            {workspace.tab ? (
              <>
                <ViewOnlyNotice />
                <PendingChanges />
                <StructureActions />
                <Tabs
                  label="Spreadsheet sections"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "rows", label: "Rows", count: Math.max(0, workspace.rows.length - 1) },
                    { value: "columns", label: "Columns", count: workspace.columnCount },
                  ]}
                />
                {view === "columns" ? <ColumnMapping mapping={false} /> : null}
              </>
            ) : null}
          </>
        }
      />
    </Screen>
  );
}
