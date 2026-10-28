import { Text as NativeText } from "react-native";
import { colors, fonts } from "../../lib/theme.js";

/**
 * @typedef {"title" | "heading" | "subheading" | "body" | "small" | "tiny" | "mono"} TextVariant
 * @typedef {"regular" | "medium" | "semibold" | "bold"} TextWeight
 */

/** @type {Record<TextVariant, { fontSize: number, lineHeight: number, weight: TextWeight }>} */
const VARIANTS = {
  title: { fontSize: 28, lineHeight: 33, weight: "bold" },
  heading: { fontSize: 21, lineHeight: 26, weight: "semibold" },
  subheading: { fontSize: 17, lineHeight: 22, weight: "semibold" },
  body: { fontSize: 15, lineHeight: 21, weight: "regular" },
  small: { fontSize: 13, lineHeight: 18, weight: "regular" },
  tiny: { fontSize: 12, lineHeight: 16, weight: "semibold" },
  mono: { fontSize: 13, lineHeight: 18, weight: "regular" },
};

/**
 * Text in the app's typeface. Long words wrap rather than running off the screen.
 * @param {import("react-native").TextProps & { variant?: TextVariant, weight?: TextWeight, color?: string, muted?: boolean }} props
 */
export function Text({ variant = "body", weight, color, muted = false, style, ...rest }) {
  const base = VARIANTS[variant];
  return (
    <NativeText
      {...rest}
      style={[
        {
          fontFamily: variant === "mono" ? fonts.mono : fonts[weight ?? base.weight],
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          color: color ?? (muted ? colors.inkMuted : variant === "title" || variant === "heading" ? colors.inkStrong : colors.ink),
        },
        style,
      ]}
    />
  );
}
