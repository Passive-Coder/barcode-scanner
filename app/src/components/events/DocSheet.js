import { useMemo, useState } from "react";
import { attempt } from "../../lib/feedback.js";
import { errorMessage, pluralize } from "../../lib/format.js";
import { parseFileLink } from "../../lib/google/drive-client.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { events } from "../../stores/events.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Choice, RadioGroup } from "../ui/Choice.js";
import { Sheet } from "../ui/Sheet.js";
import { Text } from "../ui/Text.js";
import { TextField } from "../ui/TextField.js";

/**
 * Creates a Google Sheet or Doc for the event, links an existing one, or changes who a listed
 * document is for. (Mirrors the website's DocDialog.)
 * @param {{
 *   mode: "create" | "link" | "edit",
 *   kind: "sheet" | "doc",
 *   doc?: import("../../stores/events.js").EventDoc,
 *   onClose: () => void,
 * }} props
 */
export function DocSheet({ mode, kind: initialKind, doc, onClose }) {
  useStore(events);
  const detail = events.detail;
  const [title, setTitle] = useState(doc?.title ?? "");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState(/** @type {"sheet" | "doc"} */ (doc?.kind ?? initialKind));
  const [audience, setAudience] = useState(/** @type {"everyone" | "organizers" | "subteams"} */ (doc?.audience ?? "everyone"));
  const [access, setAccess] = useState(/** @type {"writer" | "reader"} */ (doc?.access ?? "writer"));
  const [subteamIds, setSubteamIds] = useState(/** @type {string[]} */ (doc?.subteamIds ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const label = kind === "sheet" ? "Google Sheet" : "Google Doc";
  const heading = mode === "create" ? `New ${label}` : mode === "link" ? "Link an existing file" : `Access to “${doc?.title}”`;
  const linkedKind = useMemo(() => {
    try {
      return link.trim() ? parseFileLink(link).kind : null;
    } catch {
      return null;
    }
  }, [link]);
  const reach = useMemo(() => {
    if (!detail) return 0;
    const organizers = detail.members.filter((member) => member.role === "organizer").map((member) => member.email);
    if (audience === "everyone") return detail.members.length;
    if (audience === "organizers") return organizers.length;
    return new Set([...detail.subteams.filter((subteam) => subteamIds.includes(subteam.id)).flatMap((subteam) => subteam.members.map((member) => member.email)), ...organizers]).size;
  }, [detail, audience, subteamIds]);

  async function submit() {
    if (busy) return;
    setError("");
    if (mode !== "edit" && !title.trim()) return setError("Give the document a title.");
    if (audience === "subteams" && !subteamIds.length) return setError("Choose at least one sub-team.");
    setBusy(true);
    const settings = { kind: linkedKind ?? kind, title: title.trim(), audience, access, subteamIds: audience === "subteams" ? subteamIds : [] };
    try {
      if (mode === "create") {
        const { sharing } = await events.createDoc(settings);
        toast.show(sharing.failed ? `${label} created. Sharing failed for ${pluralize(sharing.failed, "person", "people")}; see its details.` : `${label} created and shared with ${pluralize(sharing.shared, "person", "people")}`);
      } else if (mode === "link") {
        await events.linkDoc({ link, ...settings });
        toast.show("Document linked");
      } else if (doc) {
        await events.updateDoc(doc.id, { title: settings.title || doc.title, audience, access, subteamIds: settings.subteamIds });
        toast.show(doc.managed ? "Access updated. Sharing in Google follows." : "Access updated");
      }
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible
      title={heading}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="primary" busy={busy} label={busy ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? `Create ${label}` : mode === "link" ? "Link file" : "Save access"} onPress={() => attempt(submit, "Could not save the document")} />
        </>
      }
    >
      <Text muted>
        {mode === "create"
          ? `Linework creates the ${label} in your Google Drive and shares it with the people below. Google emails each of them a link.`
          : mode === "link"
            ? "Lists a file you already have. Linework can't change its sharing, so share it in Google with the people below yourself."
            : doc?.managed
              ? `Linework updates the file's sharing in Google Drive to match, from ${doc.createdBy}'s account.`
              : "This file is shared by its owner in Google."}
      </Text>
      {mode === "link" ? <TextField label="Google Sheets or Docs link" value={link} onChangeText={setLink} placeholder="https://docs.google.com/…" autoCapitalize="none" keyboardType="url" autoFocus /> : null}
      {mode === "link" && link.trim() && !linkedKind ? (
        <RadioGroup label="This file is a" value={kind} onChange={setKind} options={[{ value: "sheet", label: "Google Sheet" }, { value: "doc", label: "Google Doc" }]} />
      ) : null}
      <TextField label="Title" value={title} onChangeText={setTitle} placeholder={kind === "sheet" ? "Inventory" : "Run of show"} autoFocus={mode === "create"} />
      <RadioGroup
        label="Who it's for"
        value={audience}
        onChange={setAudience}
        options={[
          { value: "everyone", label: "Everyone in the event" },
          { value: "subteams", label: detail?.subteams.length ? "Specific sub-teams" : "Specific sub-teams (create a sub-team first)", disabled: !detail?.subteams.length },
          { value: "organizers", label: "Organizers only" },
        ]}
      />
      {audience === "subteams" && detail
        ? detail.subteams.map((subteam) => (
            <Choice
              key={subteam.id}
              kind="checkbox"
              label={`${subteam.name} (${subteam.members.length})`}
              selected={subteamIds.includes(subteam.id)}
              onPress={() => setSubteamIds((ids) => (ids.includes(subteam.id) ? ids.filter((id) => id !== subteam.id) : [...ids, subteam.id]))}
            />
          ))
        : null}
      {audience !== "organizers" ? (
        <RadioGroup label="They can" value={access} onChange={setAccess} options={[{ value: "writer", label: "Edit" }, { value: "reader", label: "View only" }]} />
      ) : null}
      <Text variant="small" muted>{`Organizers can always edit. ${pluralize(reach, "person", "people")} will have access.`}</Text>
      {error ? (
        <Text weight="semibold" color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
