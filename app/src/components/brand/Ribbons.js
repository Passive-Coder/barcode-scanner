import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import { useReducedMotion } from "../../lib/motion.js";

// The website's ten strands, in their original back-to-front order.
const STRANDS = [
  { kind: "thread", offset: -0.3, width: 1.1, color: "#f1dfc6", alpha: 0.55, sway: 0.03, seed: 0.4 },
  { kind: "thread", offset: -0.26, width: 0.7, color: "#f1dfc6", alpha: 0.4, sway: 0.035, seed: 1.1 },
  { kind: "band", offset: 0, width: 0.3, color: "#3d0710", sway: 0.01, seed: 0 },
  { kind: "ribbon", offset: 0, width: 0.11, color: "cream", sway: 0.015, seed: 0.2 },
  { kind: "thread", offset: 0.1, width: 2, color: "#f2dfc5", alpha: 0.85, sway: 0.02, seed: 2 },
  { kind: "thread", offset: 0.125, width: 1, color: "#e0c7a9", alpha: 0.6, sway: 0.025, seed: 2.6 },
  { kind: "ribbon", offset: 0.17, width: 0.035, color: "cream", sway: 0.03, seed: 3.1 },
  { kind: "thread", offset: 0.2, width: 1.4, color: "#e9d3b7", alpha: 0.75, sway: 0.03, seed: 3.7 },
  { kind: "ribbon", offset: 0.22, width: 0.06, color: "ivory", sway: 0.035, seed: 4.4 },
  { kind: "thread", offset: 0.255, width: 1.2, color: "#e1c9ac", alpha: 0.7, sway: 0.04, seed: 5.2 },
];
const TAU = Math.PI * 2;
const SAMPLES = 40;

/** @param {number} value */
const round = (value) => Math.round(value * 10) / 10;

/** The native SVG version of the website's flowing ribbon field.
 * @param {{ position?: "top" | "bottom", height?: number }} props
 */
export function Ribbons({ position = "top", height = 210 }) {
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(width);
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (reduced || !focused) return;
    let frame = 0;
    let last = 0;
    const started = Date.now();
    /** @param {number} time */
    const tick = (time) => {
      if (time - last >= 33) {
        last = time;
        setElapsed(Date.now() - started);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [focused, reduced]);

  const mirror = position === "bottom";
  const flow = reduced ? 0 : TAU * ((elapsed % 12000) / 12000);
  const twist = reduced ? 0 : Math.PI * ((elapsed % 7000) / 7000);
  const swell = reduced ? 1 : 1 + 0.2 * Math.sin(Math.PI * elapsed / 5500);
  const seed = mirror ? 2.4 : 0;
  const canvasWidth = measuredWidth;

  return (
    <View pointerEvents="none" onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)} style={[styles.field, { height }, mirror ? styles.bottom : styles.top]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={height} viewBox={`0 0 ${canvasWidth} ${height}`}>
        <Defs>
          <LinearGradient id="cream" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff3dc" /><Stop offset="0.5" stopColor="#e9d7bd" /><Stop offset="1" stopColor="#fff8e9" />
          </LinearGradient>
          <LinearGradient id="ivory" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff6e4" /><Stop offset="0.5" stopColor="#f6e6cc" /><Stop offset="1" stopColor="#fff3dc" />
          </LinearGradient>
        </Defs>
        <G transform={mirror ? `rotate(180 ${canvasWidth / 2} ${height / 2})` : undefined}>
          {STRANDS.map((strand, index) => {
            const delay = 150 + (mirror ? STRANDS.length - 1 - index : index) * 70;
            const t = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - delay) / 1900));
            const reveal = 1 - (1 - t) ** 3;
            if (reveal <= 0.001) return null;
            /** @type {Array<[number, number, number]>} */
            const points = [];
            for (let i = 0; i <= SAMPLES; i++) {
              const u = -0.08 + (1.16 * reveal * i) / SAMPLES;
              const wave = 0.36 - 0.24 * (u - 0.5) + 0.14 * swell * Math.sin(TAU * 1.05 * u - flow + seed);
              const sway = strand.sway * Math.sin(TAU * 2.2 * u + 2 * flow + strand.seed);
              points.push([u * canvasWidth, (wave + strand.offset + sway) * height, u]);
            }
            if (strand.kind === "thread") {
              const d = points.map(([x, y], i) => `${i ? "L" : "M"}${round(x)} ${round(y)}`).join(" ");
              return <Path key={index} d={d} fill="none" stroke={strand.color} strokeWidth={strand.width} strokeOpacity={strand.alpha} strokeLinecap="round" />;
            }
            /** @type {Array<[number, number]>} */
            const upper = [];
            /** @type {Array<[number, number]>} */
            const lower = [];
            points.forEach(([x, y, u], i) => {
              const [px, py] = points[Math.max(0, i - 1)];
              const [nx, ny] = points[Math.min(points.length - 1, i + 1)];
              const length = Math.hypot(nx - px, ny - py) || 1;
              const facing = Math.abs(Math.cos(Math.PI * 1.6 * u + twist + strand.seed));
              const half = strand.width * height * (strand.kind === "band" ? 0.86 + 0.14 * facing : 0.22 + 0.78 * facing) / 2;
              const normalX = -(ny - py) / length;
              const normalY = (nx - px) / length;
              upper.push([x - normalX * half, y - normalY * half]);
              lower.push([x + normalX * half, y + normalY * half]);
            });
            const d = `M${upper.map(([x, y]) => `${round(x)} ${round(y)}`).join(" L")} L${lower.reverse().map(([x, y]) => `${round(x)} ${round(y)}`).join(" L")} Z`;
            return <Path key={index} d={d} fill={strand.kind === "band" ? strand.color : `url(#${strand.color})`} />;
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
