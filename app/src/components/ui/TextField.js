import { forwardRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { TOUCH, colors, fonts, radius } from "../../lib/theme.js";
import { Text } from "./Text.js";

/**
 * A labelled text input.
 * @typedef {import("react-native").TextInputProps & { label: string, hint?: string, error?: string }} TextFieldProps
 */
export const TextField = forwardRef(
  /**
   * @param {TextFieldProps} props
   * @param {import("react").ForwardedRef<TextInput>} ref
   */
  function TextField({ label, hint, error, multiline, style, ...rest }, ref) {
    return (
      <View style={styles.field}>
        <Text variant="small" weight="semibold" color={colors.inkStrong}>
          {label}
        </Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          multiline={multiline}
          style={[styles.input, multiline && styles.multiline, error ? styles.invalid : null, style]}
          {...rest}
        />
        {hint ? (
          <Text variant="small" muted>
            {hint}
          </Text>
        ) : null}
        {error ? (
          <Text variant="small" weight="semibold" color={colors.danger}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  input: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.small,
    backgroundColor: colors.field,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  invalid: {
    borderColor: colors.danger,
  },
});
