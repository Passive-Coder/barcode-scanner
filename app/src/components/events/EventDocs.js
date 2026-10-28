import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { DRIVE_FILE_SCOPE, fileUrl } from "../../lib/google/drive-client.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { auth } from "../../stores/auth.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { toast } from "../../stores/toast.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";
import { DocSheet } from "./DocSheet.js";

/** @typedef {import("../../stores/events.js").EventDoc} EventDoc */

/** The event's Google Sheets and Docs that this person may see, and creating more (organizers). */
export function EventDocs() {
  useStore(events);
  const detail = events.detail;
  const [sheet, setSheet] = useState(/** @type {{ mode: "create" | "link" | "edit", kind: "sheet" | "doc", doc?: EventDoc } | null} */ (null));
  const [opening, setOpening] = useState("");
  if (!detail) return null;
  const { me } = detail;

  /** @param {EventDoc} doc */
  function audienceLabel(doc) {
    if (doc.audience === "organizers") return "Organizers only";
    const who = doc.audience === "everyone" ? "Everyone" : detail?.subteams.filter((subteam) => doc.subteamIds.includes(subteam.id)).map((subteam) => subteam.name).join(", ") || "No sub-teams";
    return `${who} · ${doc.access === "writer" ? "can edit" : "can view"}`;
  }

  /** @param {EventDoc} doc */
  async function openInLinework(doc) {
    setOpening(doc.id);
    const opened = await attempt(async () => {
      await workspace.addLink(doc.fileId);
      return true;
    }, "Could not open the spreadsheet");
    setOpening("");
    if (opened) router.push("/sheets/edit");
  }

  /** @param {EventDoc} doc @param {boolean} retry */
  async function share(doc, retry) {
    if (!detail) return;
    const result = await attempt(async () => {
      // Google may ask for Drive access first.
      await auth.grant(DRIVE_FILE_SCOPE);
      return events.syncSharing(detail.event.id, doc.id, { retry });
    }, "Could not update sharing");
    if (!result) return;
    if (result.failed) toast.error(`Couldn't share “${doc.title}” with ${pluralize(result.failed, "person", "people")}. See the details under it.`);
    else toast.show(`Sharing for “${doc.title}” is up to date`);
  }

  /** @param {EventDoc} doc */
  async function remove(doc) {
    const confirmed = await dialogs.confirm({
      title: `Remove “${doc.title}” from the event?`,
      message: "It disappears from the event's list. The file stays in its owner's Google Drive, and the people it was shared with keep access until its owner changes that in Google.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (confirmed) await attempt(() => events.removeDoc(doc.id), "Could not remove the document");
  }

  return (
    <View style={styles.section}>
      {me.canManage ? (
        <View style={styles.create}>
          <Button variant="primary" label="New Google Sheet" onPress={() => setSheet({ mode: "create", kind: "sheet" })} />
          <Button label="New Google Doc" onPress={() => setSheet({ mode: "create", kind: "doc" })} />
          <Button variant="quiet" label="Link an existing file" onPress={() => setSheet({ mode: "link", kind: "sheet" })} />
        </View>
      ) : null}
      {detail.docs.length ? (
        detail.docs.map((doc) => {
          const syncing = events.syncing.includes(doc.id);
          return (
            <View key={doc.id} style={styles.doc}>
              <View style={styles.titleRow}>
                <View style={[styles.glyph, { backgroundColor: doc.kind === "sheet" ? "#1e8e4e" : "#3b6fd8" }]} />
                <Text weight="semibold" style={styles.flex}>
                  {doc.title}
                </Text>
              </View>
              <View style={styles.meta}>
                <Pill label={doc.kind === "sheet" ? "Sheet" : "Doc"} />
                {doc.myAccess === "reader" ? <Pill label="View only" /> : null}
              </View>
              <Text variant="small" muted>
                {audienceLabel(doc)}
              </Text>
              {doc.sharing || !doc.managed ? (
                <Text variant="small" muted>
                  {syncing ? "Updating sharing…" : !doc.managed ? "Shared by its owner in Google" : `Shared with ${pluralize(doc.sharing?.shared ?? 0, "person", "people")}${doc.sharing?.pending ? ` · ${doc.sharing.pending} waiting` : ""}`}
                </Text>
              ) : null}
              {doc.sharing?.pending && doc.createdBy !== me.email ? <Text variant="small">{`Sharing changes are made from ${doc.createdBy}'s Google account, the next time they open Linework.`}</Text> : null}
              {doc.sharing?.failed.length ? (
                <View style={styles.failed}>
                  <Text variant="small" weight="semibold" color={colors.danger}>{`Couldn't share with ${pluralize(doc.sharing.failed.length, "person", "people")}:`}</Text>
                  {doc.sharing.failed.map((failure) => (
                    <Text key={failure.email} variant="small">{`${failure.email} — ${failure.error || "Google refused"}`}</Text>
                  ))}
                </View>
              ) : null}
              <View style={styles.links}>
                {doc.kind === "sheet" ? <Button variant="quiet" label={opening === doc.id ? "Opening…" : "Open in Linework"} disabled={Boolean(opening)} onPress={() => openInLinework(doc)} /> : null}
                <Button variant="quiet" label={`Open in Google ${doc.kind === "sheet" ? "Sheets" : "Docs"}`} onPress={() => Linking.openURL(fileUrl(doc.kind, doc.fileId))} />
                {doc.managed && doc.createdBy === me.email && (doc.sharing?.pending || doc.sharing?.failed.length) ? (
                  <Button variant="quiet" label={doc.sharing?.pending ? "Share now" : "Retry sharing"} disabled={syncing} onPress={() => share(doc, Boolean(doc.sharing?.failed.length))} />
                ) : null}
                {me.canManage ? <Button variant="quiet" label="Access" onPress={() => setSheet({ mode: "edit", kind: doc.kind, doc })} /> : null}
                {me.canManage ? <Button variant="quiet" label="Remove" onPress={() => remove(doc)} /> : null}
              </View>
            </View>
          );
        })
      ) : (
        <Empty text={me.canManage ? "No documents yet. Create a Google Sheet or Doc for this event, and Linework shares it with the people you choose." : "No documents have been shared with you in this event yet."} />
      )}
      {sheet ? <DocSheet mode={sheet.mode} kind={sheet.kind} doc={sheet.doc} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  create: {
    gap: 8,
  },
  doc: {
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  glyph: {
    width: 18,
    height: 24,
    borderRadius: 3,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  failed: {
    gap: 2,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
  },
});
