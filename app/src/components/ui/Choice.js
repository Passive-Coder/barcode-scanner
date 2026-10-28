import { Pressable, StyleSheet, View } from "react-native";
import { TOUCH, colors } from "../../lib/theme.js";
import { Text } from "./Text.js";

/**
 * One option of a radio group or a checkbox, as a full-width row that's easy to tap.
 * @param {{
 *   label: string,
 *   description?: string,
 *   selected: boolean,
 *   onPress: () => void,
 *   kind?: "radio" | "checkbox",
 *   disabled?: boolean,
 * }} props
 */
export function Choice({ label, description, selected, onPress, kind = "radio", disabled = false }) {
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[kind === "radio" ? styles.radio : styles.checkbox, selected && styles.on]}>{selected ? <View style={kind === "radio" ? styles.dot : styles.tick} /> : null}</View>
      <View style={styles.text}>
        <Text>{label}</Text>
        {description ? (
          <Text variant="small" muted>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * A labelled group of choices, one of which is picked.
 * @template {string} T
 * @param {{ label: string, value: T, options: Array<{ value: T, label: string, description?: string, disabled?: boolean }>, onChange: (value: T) => void }} props
 */
export function RadioGroup({ label, value, options, onChange }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Text variant="small" weight="semibold" color={colors.inkStrong}>
        {label}
      </Text>
      {options.map((option) => (
        <Choice key={option.value} label={option.label} description={option.description} selected={option.value === value} disabled={option.disabled} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 2,
  },
  row: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  on: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onAccent,
  },
  tick: {
    width: 10,
    height: 6,
    marginTop: -2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.onAccent,
    transform: [{ rotate: "-45deg" }],
  },
});
