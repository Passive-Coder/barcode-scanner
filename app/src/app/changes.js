import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ChangeRow } from "../components/sheets/ChangeRow.js";
import { Button } from "../components/ui/Button.js";
import { Empty } from "../components/ui/Empty.js";
import { Screen } from "../components/ui/Screen.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Text } from "../components/ui/Text.js";
import { attempt } from "../lib/feedback.js";
import { formatDateTime } from "../lib/format.js";
import { useStore } from "../lib/store.js";
import { colors } from "../lib/theme.js";
import { account } from "../stores/account.js";
import { changeLog } from "../stores/changes.js";
import { workspace } from "../stores/workspace.js";

/**
 * The open spreadsheet's change log for the signed-in person: changes waiting to be migrated,
 * those that need attention, and the history of everything recorded. (Mirrors the website's
 * ChangesDialog.)
 */
export default function Changes() {
  useStore(changeLog);
  useStore(workspace);
  useStore(account);
  const id = workspace.activeId;
  const [view, setView] = useState("waiting");
  const [loading, setLoading] = useState(false);
  const chosen = useRef(false);

  const waiting = [...changeLog.local.filter((change) => change.spreadsheetId === id), ...changeLog.open.filter((change) => change.status !== "conflict")];
  const attention = changeLog.open.filter((change) => change.status === "conflict");
  const list = view === "waiting" ? waiting : view === "attention" ? attention : changeLog.history;

  async function load() {
    if (!id || !account.ready) return;
    setLoading(true);
    await attempt(() => changeLog.load(id), "Could not load the change log");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id, account.ready]);

  // Open where the person most likely needs to look, once the list has loaded.
  useEffect(() => {
    if (chosen.current || loading || changeLog.loadedFor !== id) return;
    chosen.current = true;
    if (attention.length && !waiting.length) setView("attention");
  }, [loading, changeLog.loadedFor, id]);

  /** @param {string[]} ids */
  const discard = (ids) => attempt(() => changeLog.discard(id, ids), "Could not discard changes");
  /** @param {string[]} ids */
  const retry = (ids) => attempt(() => changeLog.retry(id, ids), "Could not retry changes");

  return (
    <Screen title="Change log" subtitle={workspace.title || undefined} onRefresh={load} refreshing={loading}>
      <Text muted>{`Changes you made to “${workspace.title || "this spreadsheet"}” through Linework. Only you can see this list.${changeLog.history[0] ? ` Last change ${formatDateTime(new Date(changeLog.history[0].createdAt))}.` : ""}`}</Text>
      {!id ? (
        <Empty text="Open a spreadsheet to see its change log." />
      ) : (
        <>
          <Tabs
            label="Change log"
            value={view}
            onChange={setView}
            options={[
              { value: "waiting", label: "Waiting", count: waiting.length },
              { value: "attention", label: "Needs attention", count: attention.length },
              { value: "history", label: "History" },
            ]}
          />
          {list.length ? (
            <View style={styles.list}>
              {list.map((change) => (
                <ChangeRow
                  key={change.id}
                  change={change}
                  actions={
                    change.status === "conflict" ? (
                      <>
                        <Button variant="quiet" label="Try again" onPress={() => retry([change.id])} />
                        <Button variant="quiet" textColor={colors.danger} label="Discard" onPress={() => discard([change.id])} />
                      </>
                    ) : change.status === "pending" ? (
                      <Button variant="quiet" textColor={colors.danger} label="Discard" onPress={() => discard([change.id])} />
                    ) : null
                  }
                />
              ))}
            </View>
          ) : (
            <Empty text={loading ? "Loading…" : view === "waiting" ? "Nothing is waiting to be migrated." : view === "attention" ? "Nothing needs your attention." : "No changes recorded yet."} />
          )}
          {view === "attention" && attention.length > 1 ? (
            <View style={styles.bulk}>
              <Button variant="quiet" label="Try all again" onPress={() => retry(attention.map((change) => change.id))} />
              <Button variant="quiet" textColor={colors.danger} label="Discard all" onPress={() => discard(attention.map((change) => change.id))} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  bulk: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
  },
});
