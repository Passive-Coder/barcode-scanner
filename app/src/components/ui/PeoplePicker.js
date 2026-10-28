import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { displayName } from "../../lib/people.js";
import { TOUCH, colors, fonts, radius } from "../../lib/theme.js";
import { Choice } from "./Choice.js";
import { Text } from "./Text.js";

/**
 * A searchable checklist of people. With `managers`, each chosen person can also be marked as a
 * manager. (Mirrors the website's PeoplePicker.)
 * @param {{
 *   people: Array<{ email: string, name: string }>,
 *   selected: string[],
 *   onChange: (selected: string[]) => void,
 *   managers?: string[],
 *   onManagersChange?: (managers: string[]) => void,
 *   label: string,
 * }} props
 */
export function PeoplePicker({ people, selected, onChange, managers, onManagersChange, label }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? people.filter((person) => person.email.includes(term) || person.name.toLowerCase().includes(term)) : people;
  }, [people, query]);
  const allShown = filtered.length > 0 && filtered.every((person) => selected.includes(person.email));

  /** @param {string} email @param {boolean} on */
  function toggle(email, on) {
    onChange(on ? [...new Set([...selected, email])] : selected.filter((item) => item !== email));
    if (!on && managers && onManagersChange) onManagersChange(managers.filter((item) => item !== email));
  }

  /** @param {string} email @param {boolean} on */
  function toggleManager(email, on) {
    if (!managers || !onManagersChange) return;
    onManagersChange(on ? [...new Set([...managers, email])] : managers.filter((item) => item !== email));
    if (on && !selected.includes(email)) onChange([...selected, email]);
  }

  function toggleAll() {
    const emails = filtered.map((person) => person.email);
    if (allShown) {
      onChange(selected.filter((email) => !emails.includes(email)));
      if (managers && onManagersChange) onManagersChange(managers.filter((email) => !emails.includes(email)));
    } else onChange([...new Set([...selected, ...emails])]);
  }

  return (
    <View style={styles.picker} accessibilityLabel={label}>
      <Text variant="small" weight="semibold" color={colors.inkStrong}>
        {label}
      </Text>
      <View style={styles.tools}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={colors.placeholder} accessibilityLabel="Search people" autoCapitalize="none" style={styles.search} />
        <Pressable accessibilityRole="button" disabled={!filtered.length} onPress={toggleAll} style={styles.all}>
          <Text variant="small" weight="semibold">
            {allShown ? "Clear" : "Select all"}
          </Text>
        </Pressable>
      </View>
      <Text variant="small" muted>{`${selected.length} of ${people.length} selected`}</Text>
      {filtered.length ? (
        <View style={styles.list}>
          {filtered.map((person) => (
            <View key={person.email} style={styles.person}>
              <View style={styles.flex}>
                <Choice
                  kind="checkbox"
                  label={displayName(person)}
                  description={person.name ? person.email : undefined}
                  selected={selected.includes(person.email)}
                  onPress={() => toggle(person.email, !selected.includes(person.email))}
                />
              </View>
              {managers ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: managers.includes(person.email) }}
                  accessibilityLabel={`${displayName(person)} manages this sub-team`}
                  onPress={() => toggleManager(person.email, !managers.includes(person.email))}
                  style={[styles.manager, managers.includes(person.email) && styles.managerOn]}
                >
                  <Text variant="tiny" color={managers.includes(person.email) ? colors.onAccent : colors.ink}>
                    Manager
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text muted>{people.length ? "No one matches that search." : "No people to choose from yet."}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: 8,
  },
  tools: {
    flexDirection: "row",
    gap: 8,
  },
  search: {
    flex: 1,
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.small,
    backgroundColor: colors.field,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  all: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.small,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.small,
    paddingHorizontal: 10,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  manager: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
  },
  managerOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
