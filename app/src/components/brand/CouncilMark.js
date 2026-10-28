import Svg, { Circle, G, Path } from "react-native-svg";
import { decorativeSvgProps } from "../../lib/a11y.js";

/**
 * The Student Council mark: five figures in a pinwheel (the same drawing as the website's).
 * One figure is repeated every 72°, so the mark is exactly symmetric.
 */
const BODY =
  "M15,-32 C13.8,-34 12.2,-35.4 10.3,-35.2 C8.2,-35 6.6,-31.4 4,-30.4 C1.6,-29.6 -1.6,-29.6 -3.6,-30.8 " +
  "C-5.6,-32 -7.6,-36.3 -9.7,-36.3 C-12.2,-36.3 -16.3,-31.4 -16.9,-26.5 C-17.6,-20.5 -16.6,-14.6 -13.2,-9.2 " +
  "C-10.6,-5.2 -7.3,-2.6 -4,-1 C-6.8,-6.4 -7.6,-12 -6.6,-16.6 C-5.6,-21.4 -2.2,-25.4 2.4,-27.2 " +
  "C7,-28.8 12.6,-27.8 17,-25 C17.6,-26.6 17,-29.8 15,-32 Z";
const ANGLES = [0, 72, 144, 216, 288];

/** @param {{ size?: number, color?: string }} props */
export function CouncilMark({ size = 48, color = "#f8ebd9" }) {
  return (
    <Svg width={size} height={size} viewBox="-52 -52 104 104" {...decorativeSvgProps}>
      <G fill={color}>
        {ANGLES.map((angle) => (
          <G key={angle} transform={`rotate(${angle})`}>
            <G transform="translate(-1 -3.1)">
              <Circle cx={0.5} cy={-40.5} r={6.4} />
              <Path d={BODY} />
            </G>
          </G>
        ))}
      </G>
    </Svg>
  );
}
