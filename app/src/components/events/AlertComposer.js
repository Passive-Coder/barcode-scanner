import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { displayName } from "../../lib/people.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Choice, RadioGroup } from "../ui/Choice.js";
import { PeoplePicker } from "../ui/PeoplePicker.js";
import { Text } from "../ui/Text.js";
import { TextField } from "../ui/TextField.js";

/**
 * Sends an alert. Organizers can alert everyone, sub-teams, or tagged people; managers can alert
 * the sub-teams they manage, or tag people in them. A page takes over the recipients' screens
 * until they acknowledge it. (Mirrors the website's AlertComposer.)
 */
export function AlertComposer() {
  useStore(events);
  const detail = events.detail;
  const me = detail?.me;
  const organizer = me?.role === "organizer";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState(/** @type {"notice" | "page"} */ ("page"));
  // Organizers usually alert everyone; managers start from the sub-teams they manage.
  const [audience, setAudience] = useState(() => /** @type {"everyone" | "subteams" | "people"} */ (events.detail?.me.role === "organizer" ? "everyone" : "subteams"));
  const [subteamIds, setSubteamIds] = useState(() => /** @type {string[]} */ (events.detail?.me.role === "organizer" ? [] : [...(events.detail?.me.manages ?? [])]));
  const [emails, setEmails] = useState(/** @type {string[]} */ ([]));
  const [busy, setBusy] = useState(false);

  /** Sub-teams this person may alert. */
  const subteams = useMemo(() => (detail?.subteams ?? []).filter((subteam) => organizer || me?.manages.includes(subteam.id)), [detail, organizer, me]);
  /** People this person may tag: anyone (organizers) or members of their sub-teams (managers). */
  const reachable = useMemo(() => {
    if (!detail || !me) return [];
    const allowed = organizer ? null : new Set(subteams.flatMap((subteam) => subteam.members.map((member) => member.email)));
    return detail.members.filter((member) => member.email !== me.email && (!allowed || allowed.has(member.email))).map((member) => ({ email: member.email, name: member.name }));
  }, [detail, me, organizer, subteams]);
  const recipients = useMemo(() => {
    if (!detail || !me) return 0;
    if (audience === "everyone") return detail.members.filter((member) => member.email !== me.email).length;
    if (audience === "people") return emails.length;
    return new Set(subteams.filter((subteam) => subteamIds.includes(subteam.id)).flatMap((subteam) => subteam.members.map((member) => member.email)).filter((email) => email !== me.email)).size;
  }, [detail, me, audience, emails, subteams, subteamIds]);

  if (!detail || !me) return null;

  /** @returns {import("../../stores/events.js").AlertAudience} */
  function audiencePayload() {
    if (audience === "everyone") return { type: "everyone" };
    if (audience === "subteams") return { type: "subteams", subteamIds };
    return { type: "people", emails };
  }

  function audienceText() {
    if (audience === "everyone") return "everyone in the event";
    if (audience === "people") return emails.length === 1 ? displayName(reachable.find((person) => person.email === emails[0]) ?? { email: emails[0] }) : pluralize(emails.length, "person", "people");
    return subteams.filter((subteam) => subteamIds.includes(subteam.id)).map((subteam) => subteam.name).join(", ");
  }

  async function submit() {
    if (busy) return;
    if (!title.trim()) return toast.error("Give the alert a title.");
    if (audience === "subteams" && !subteamIds.length) return toast.error("Choose at least one sub-team.");
    if (audience === "people" && !emails.length) return toast.error("Tag at least one person.");
    if (!recipients) return toast.error("There's no one else in that audience to alert.");
    if (urgency === "page") {
      const confirmed = await dialogs.confirm({
        title: `Page ${audienceText()}?`,
        message: `${pluralize(recipients, "person", "people")} will see “${title.trim()}” fill their screen until they acknowledge it, and get a notification on phones and browsers where they turned alerts on.`,
        confirmLabel: "Send page",
        danger: true,
      });
      if (!confirmed) return;
    }
    setBusy(true);
    const sent = await attempt(() => events.sendAlert({ title: title.trim(), body: body.trim(), urgency, audience: audiencePayload() }), "Could not send the alert");
    setBusy(false);
    if (!sent) return;
    toast.show(`${urgency === "page" ? "Page" : "Alert"} sent to ${pluralize(sent.recipientCount ?? recipients, "person", "people")}${sent.devices ? ` (${pluralize(sent.devices, "device")} notified)` : ""}`);
    setTitle("");
    setBody("");
    setEmails([]);
  }

  return (
    <View style={styles.composer}>
      <Text variant="subheading" accessibilityRole="header">
        Send an alert
      </Text>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Doors open in 10 minutes" editable={!busy} />
      <TextField label="Message (optional)" value={body} onChangeText={setBody} maxLength={1000} placeholder="Everyone to the main gate." multiline editable={!busy} />
      <RadioGroup
        label="How"
        value={urgency}
        onChange={setUrgency}
        options={[
          { value: "page", label: "Page", description: "Fills their screen until acknowledged", disabled: busy },
          { value: "notice", label: "Notice", description: "A notification and a note in their alerts", disabled: busy },
        ]}
      />
      <RadioGroup
        label="To"
        value={audience}
        onChange={setAudience}
        options={[
          ...(organizer ? [{ value: /** @type {const} */ ("everyone"), label: "Everyone in the event", disabled: busy }] : []),
          { value: "subteams", label: `${organizer ? "Sub-teams" : "Your sub-teams"}${subteams.length ? "" : " (none yet)"}`, disabled: busy || !subteams.length },
          { value: "people", label: "Tag people", disabled: busy || !reachable.length },
        ]}
      />
      {audience === "subteams" ? (
        <View accessibilityLabel="Sub-teams to alert">
          {subteams.map((subteam) => (
            <Choice
              key={subteam.id}
              kind="checkbox"
              label={`${subteam.name} (${subteam.members.length})`}
              selected={subteamIds.includes(subteam.id)}
              disabled={busy}
              onPress={() => setSubteamIds((ids) => (ids.includes(subteam.id) ? ids.filter((id) => id !== subteam.id) : [...ids, subteam.id]))}
            />
          ))}
        </View>
      ) : audience === "people" ? (
        <PeoplePicker label="People to tag" people={reachable} selected={emails} onChange={setEmails} />
      ) : null}
      <Text variant="small" muted>
        {recipients ? `${pluralize(recipients, "person", "people")} will be alerted` : "Choose who to alert"}
      </Text>
      <Button variant={urgency === "page" ? "danger" : "primary"} busy={busy} label={busy ? "Sending…" : urgency === "page" ? "Send page" : "Send notice"} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
});
