import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { auth } from "../../stores/auth.js";
import { changeLog } from "../../stores/changes.js";
import { toast } from "../../stores/toast.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Text } from "../ui/Text.js";

/**
 * Changes stored in Linework because Google Sheets couldn't take them. They're added
 * automatically as soon as Google responds; Migrate changes does it right away.
 */
export function PendingChanges() {
  useStore(changeLog);
  useStore(workspace);
  useStore(auth);
  useStore(account);
  const id = workspace.activeId;
  const counts = changeLog.counts(id);
  if (!id || (!counts.pending && !counts.conflicts)) return null;
  const stuck = changeLog.blocked[id] ?? "";
  const blocker = !counts.pending
    ? "Nothing is waiting to be migrated."
    : auth.status === "expired"
      ? "Reconnect Google to migrate."
      : !auth.connected
        ? "Connect Google to migrate."
        : workspace.readOnly
          ? "This account needs Editor access to migrate."
          : !account.ready
            ? "Linework's server can't be reached yet."
            : "";
  const it = counts.pending === 1 ? "it" : "them";

  async function migrate() {
    const outcome = await attempt(() => changeLog.migrate(id), "Could not migrate changes");
    if (!outcome) return;
    const { applied, conflicts } = outcome;
    if (applied) toast.show(`${pluralize(applied, "change")} migrated to Google Sheets${conflicts ? `; ${pluralize(conflicts, "change")} need${conflicts === 1 ? "s" : ""} your attention` : ""}.`);
    else if (conflicts) toast.error(`${pluralize(conflicts, "change")} couldn't be placed safely. Review them to decide what to do.`);
    if (id === workspace.activeId) await attempt(() => workspace.refresh(), "Could not reload the spreadsheet");
  }

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text weight="semibold" color={colors.inkStrong}>
        {counts.pending ? `${pluralize(counts.pending, "change")} stored in Linework` : `${pluralize(counts.conflicts, "change")} need${counts.conflicts === 1 ? "s" : ""} your attention`}
      </Text>
      <Text variant="small" muted>
        {counts.pending
          ? changeLog.migrating
            ? `Adding ${it} to Google Sheets now…`
            : `Google Sheets couldn't be reached when ${counts.pending === 1 ? "it was" : "they were"} made. Linework adds ${it} to the right tab and columns automatically as soon as Google responds, without overwriting anything changed since.${counts.local ? ` ${pluralize(counts.local, "change")} ${counts.local === 1 ? "is" : "are"} still on this phone and will upload first.` : ""}`
          : "These couldn't be placed without overwriting newer data. Review them to retry or discard."}
      </Text>
      {stuck && counts.pending ? (
        <Text variant="small" weight="semibold">{`Couldn't add ${it} automatically: ${stuck}`}</Text>
      ) : blocker && counts.pending ? (
        <Text variant="small" weight="semibold">
          {blocker}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button variant="primary" label={changeLog.migrating ? "Migrating…" : "Migrate changes"} busy={changeLog.migrating} disabled={Boolean(blocker)} onPress={migrate} />
        <Button variant="quiet" label="Review" onPress={() => router.push("/changes")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.lineStrong,
    borderLeftColor: colors.accent,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
  },
});
