import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button } from "../../components/ui/Button.js";
import { Empty } from "../../components/ui/Empty.js";
import { Screen } from "../../components/ui/Screen.js";
import { Text } from "../../components/ui/Text.js";
import { TextField } from "../../components/ui/TextField.js";
import { attempt } from "../../lib/feedback.js";
import { forgetLink } from "../../lib/sheet-actions.js";
import { useStore } from "../../lib/store.js";
import { TOUCH, colors, radius } from "../../lib/theme.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";

/**
 * Choosing a spreadsheet: one added before, or a new one by its link. With an intent (scan or
 * edit), it continues to the scanner or the editor; otherwise it goes back to where it came from.
 */
export default function ChooseSheet() {
  useStore(workspace);
  useStore(auth);
  const { intent } = useLocalSearchParams();
  const next = intent === "scan" || intent === "edit" ? intent : null;
  const [opening, setOpening] = useState(/** @type {string | null} */ (null));
  const [url, setUrl] = useState("");
  const [linking, setLinking] = useState(false);

  function proceed() {
    if (next) router.push(`/sheets/${next}`);
    else if (router.canGoBack()) router.back();
    else router.replace("/sheets/edit");
  }

  /** @param {string} id */
  async function open(id) {
    if (opening) return;
    setOpening(id);
    const opened = await attempt(async () => {
      await workspace.open(id);
      return true;
    }, "Could not open spreadsheet");
    setOpening(null);
    if (opened) proceed();
  }

  async function link() {
    if (linking || !url.trim()) return;
    setLinking(true);
    const linked = await attempt(async () => {
      await workspace.addLink(url);
      return true;
    }, "Could not open spreadsheet");
    setLinking(false);
    if (linked) {
      setUrl("");
      proceed();
    }
  }

  return (
    <Screen title={next === "scan" ? "Scan into a sheet" : next === "edit" ? "Edit a sheet" : "Spreadsheets"}>
      {workspace.links.length ? (
        <View style={styles.list}>
          <Text variant="subheading" accessibilityRole="header">
            Your spreadsheets
          </Text>
          {workspace.links.map((item) => (
            <View key={item.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                accessibilityState={{ disabled: Boolean(opening), busy: opening === item.id }}
                disabled={Boolean(opening)}
                onPress={() => open(item.id)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed, item.id === workspace.activeId && styles.current]}
              >
                <Text weight="semibold" style={styles.flex}>
                  {item.title}
                </Text>
                {opening === item.id ? <ActivityIndicator color={colors.ink} /> : <Text color={colors.inkMuted}>›</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${item.title}`} hitSlop={4} onPress={() => forgetLink(item.id)} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
                <Text variant="subheading" color={colors.inkMuted}>
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Empty text="No spreadsheets yet. Add one with its Google Sheets link." />
      )}
      <View style={styles.add}>
        <TextField
          label="Add a spreadsheet"
          value={url}
          onChangeText={setUrl}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!linking}
          returnKeyType="go"
          onSubmitEditing={link}
          hint={auth.connected ? "Paste its link from Google Sheets (Share → Copy link), or its ID." : "Connect Google first."}
        />
        <Button variant="primary" label="Add spreadsheet" busy={linking} disabled={!url.trim() || !auth.connected} onPress={link} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  item: {
    flex: 1,
    minHeight: TOUCH + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  current: {
    borderColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  remove: {
    width: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
  },
  add: {
    gap: 12,
    marginTop: 8,
  },
});
