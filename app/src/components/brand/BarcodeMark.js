import Svg, { Rect } from "react-native-svg";
import { decorativeSvgProps } from "../../lib/a11y.js";

/** Linework's barcode mark (the app icon's bars). @param {{ size?: number, color?: string }} props */
export function BarcodeMark({ size = 32, color = "#f8ebd5" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...decorativeSvgProps}>
      <Rect x={3} y={4} width={2} height={24} fill={color} />
      <Rect x={7} y={7} width={4} height={18} fill={color} />
      <Rect x={13} y={2} width={2} height={28} fill={color} />
      <Rect x={17} y={6} width={3} height={20} fill={color} />
      <Rect x={23} y={4} width={1.5} height={24} fill={color} opacity={0.8} />
      <Rect x={26.5} y={7} width={2.5} height={18} fill={color} />
    </Svg>
  );
}
