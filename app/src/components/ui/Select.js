import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TOUCH, colors, radius } from "../../lib/theme.js";
import { Choice } from "./Choice.js";
import { Sheet } from "./Sheet.js";
import { Text } from "./Text.js";

/**
 * A field that opens a list to pick one value from.
 * @template {string} T
 * @param {{
 *   label: string,
 *   value: T,
 *   options: Array<{ value: T, label: string, description?: string }>,
 *   onChange: (value: T) => void,
 *   placeholder?: string,
 *   disabled?: boolean,
 *   hideLabel?: boolean,
 * }} props
 */
export function Select({ label, value, options, onChange, placeholder = "Choose…", disabled = false, hideLabel = false }) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View style={styles.field}>
      {hideLabel ? null : (
        <Text variant="small" weight="semibold" color={colors.inkStrong}>
          {label}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityHint="Opens a list to choose from"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.control, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={styles.value} numberOfLines={2} color={current ? colors.ink : colors.placeholder}>
          {current?.label ?? placeholder}
        </Text>
        <Text color={colors.inkMuted}>▾</Text>
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            description={option.description}
            selected={option.value === value}
            onPress={() => {
              setOpen(false);
              if (option.value !== value) onChange(option.value);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  control: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.small,
    backgroundColor: colors.field,
  },
  pressed: {
    borderColor: colors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  value: {
    flex: 1,
  },
});
