import { Platform } from "react-native";

/** Hide decorative SVG marks from screen readers on native and web. */
export const decorativeSvgProps = Platform.OS === "web"
  ? { "aria-hidden": true }
  : /** @type {const} */ ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
