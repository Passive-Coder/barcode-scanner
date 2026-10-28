/**
 * The welcome screen's ribbon bundle: a deep wine band carrying cream silk ribbons and fine
 * threads that all follow one flowing curve, each with a little motion of its own.
 *
 * Offsets and widths are chosen with the wave in ribbon-field.js so the whole bundle stays
 * inside the canvas on its inner edge; it only ever leaves through the screen edge.
 *
 * @typedef {{
 *   kind: "band" | "ribbon" | "thread",
 *   offset: number,   // distance from the bundle's centre line, in canvas heights
 *   width: number,    // band/ribbon width in canvas heights; thread width in CSS pixels
 *   color: string,    // a palette name for ribbons, a CSS color otherwise
 *   alpha?: number,
 *   sway: number,     // amplitude of the strand's own wave, in canvas heights
 *   seed: number,     // phase offset so strands drift apart and rejoin
 * }} Strand
 */

/** Cream gradients across the width of each ribbon, and the darker reverse side shown as it twists. */
export const RIBBON_PALETTES = {
  cream: { front: ["#fff3dc", "#e9d7bd", "#fff8e9"], back: "#c4a582" },
  ivory: { front: ["#fff6e4", "#f6e6cc", "#fff3dc"], back: "#cfb18f" },
};

/** @type {Strand[]} drawn in order, back to front */
export const RIBBON_STRANDS = [
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
