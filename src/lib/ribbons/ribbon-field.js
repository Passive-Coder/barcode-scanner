import { gsap } from "gsap";
import { prefersReducedMotion } from "../motion.js";
import { RIBBON_PALETTES, RIBBON_STRANDS } from "./strands.js";

/**
 * Ribbons drawn on a canvas and animated entirely by GSAP: a staggered unfurl, a wave that
 * flows along the bundle, silk ribbons that twist to show their reverse side, and a slow swell.
 * GSAP tweens the parameters; `gsap.ticker` redraws the canvas each frame.
 *
 * @typedef {import("./strands.js").Strand} Strand
 * @typedef {Strand & { reveal: number }} LiveStrand
 * @typedef {[x: number, y: number, u: number]} Sample
 */

const TAU = Math.PI * 2;
const SAMPLES = 96;
/** Curves start and end just outside the canvas so their ends never show. */
const START_U = -0.08;
const SPAN_U = 1.16;

/** @param {string} hex */
const toRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

/** @param {number[]} a @param {number[]} b @param {number} t */
const mix = (a, b, t) => a.map((value, index) => Math.round(value + (b[index] - value) * t));

const PALETTES = Object.fromEntries(
  Object.entries(RIBBON_PALETTES).map(([name, { front, back }]) => [name, { front: front.map(toRgb), back: toRgb(back) }]),
);

export class RibbonField {
  /** Values GSAP tweens: wave travel, twist travel, and wave height. */
  state = { flow: 0, twist: 0, swell: 1 };
  /** @type {gsap.core.Animation[]} */
  #animations = [];
  /** @type {ResizeObserver | undefined} */
  #observer;
  #width = 0;
  #height = 0;
  #dpr = 1;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mirror?: boolean, seed?: number }} [options] `mirror` turns the bundle 180° for the bottom edge
   */
  constructor(canvas, { mirror = false, seed = 0 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mirror = mirror;
    this.seed = seed;
    /** @type {LiveStrand[]} */
    this.strands = RIBBON_STRANDS.map((strand) => ({ ...strand, reveal: 0 }));
    this.render = this.render.bind(this);

    this.#observer = new ResizeObserver(() => this.#resize());
    this.#observer.observe(canvas);
    this.#resize();

    if (prefersReducedMotion()) {
      for (const strand of this.strands) strand.reveal = 1;
      this.render();
      return;
    }
    this.#animate();
  }

  #animate() {
    // The loops wrap seamlessly: every wave term uses a whole multiple of `flow` (period 2π),
    // and the twist uses |cos|, whose period is π.
    this.#animations.push(
      gsap.to(this.strands, { reveal: 1, duration: 1.9, ease: "power3.out", stagger: { each: 0.07, from: this.mirror ? "end" : "start" }, delay: 0.15 }),
      gsap.to(this.state, { flow: TAU, duration: 12, ease: "none", repeat: -1 }),
      gsap.to(this.state, { twist: Math.PI, duration: 7, ease: "none", repeat: -1 }),
      gsap.to(this.state, { swell: 1.2, duration: 5.5, ease: "sine.inOut", repeat: -1, yoyo: true }),
    );
    gsap.ticker.add(this.render);
  }

  #resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.#dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#width = width;
    this.#height = height;
    this.canvas.width = Math.round(width * this.#dpr);
    this.canvas.height = Math.round(height * this.#dpr);
    this.render();
  }

  /** Height of a strand's centre line at horizontal position `u` (0 = left edge, 1 = right edge). @param {LiveStrand} strand @param {number} u */
  #centreY(strand, u) {
    const { flow, swell } = this.state;
    // One shared S-shaped wave, rising to the right and travelling along the bundle. It sits in
    // the outer part of the canvas so the bundle never reaches the inner edge (see strands.js)…
    const wave = 0.36 - 0.24 * (u - 0.5) + 0.14 * swell * Math.sin(TAU * 1.05 * u - flow + this.seed);
    // …plus each strand's own faster wave, so the strands part and rejoin.
    const sway = strand.sway * Math.sin(TAU * 2.2 * u + 2 * flow + strand.seed);
    return (wave + strand.offset + sway) * this.#height;
  }

  /** How face-on a twisting ribbon is at `u`: 1 is flat to the viewer, 0 is edge-on. @param {LiveStrand} strand @param {number} u */
  #facing(strand, u) {
    return Math.abs(Math.cos(Math.PI * 1.6 * u + this.state.twist + strand.seed));
  }

  /** @param {LiveStrand} strand @returns {Sample[]} */
  #samples(strand) {
    const span = SPAN_U * strand.reveal;
    return Array.from({ length: SAMPLES + 1 }, (_, index) => {
      const u = START_U + (span * index) / SAMPLES;
      return /** @type {Sample} */ ([u * this.#width, this.#centreY(strand, u), u]);
    });
  }

  /**
   * Traces a strip of varying width around the centre line, offset along its normals.
   * @param {CanvasRenderingContext2D} ctx @param {Sample[]} samples @param {(u: number) => number} halfWidth
   * @returns {Array<[number, number]>} the upper edge, for the sheen line
   */
  #traceStrip(ctx, samples, halfWidth) {
    /** @type {Array<[number, number]>} */
    const upper = [];
    /** @type {Array<[number, number]>} */
    const lower = [];
    samples.forEach(([x, y, u], index) => {
      const [px, py] = samples[Math.max(0, index - 1)];
      const [nx, ny] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, ny - py) || 1;
      const normalX = -(ny - py) / length;
      const normalY = (nx - px) / length;
      const half = halfWidth(u);
      upper.push([x - normalX * half, y - normalY * half]);
      lower.push([x + normalX * half, y + normalY * half]);
    });
    ctx.beginPath();
    upper.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let index = lower.length - 1; index >= 0; index--) ctx.lineTo(lower[index][0], lower[index][1]);
    ctx.closePath();
    return upper;
  }

  /** @param {CanvasRenderingContext2D} ctx @param {LiveStrand} strand @param {Sample[]} samples */
  #drawThread(ctx, strand, samples) {
    ctx.beginPath();
    samples.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.globalAlpha = strand.alpha ?? 1;
    ctx.strokeStyle = strand.color;
    ctx.lineWidth = strand.width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** The wine band, with a soft shadow beneath it. @param {CanvasRenderingContext2D} ctx @param {LiveStrand} strand @param {Sample[]} samples */
  #drawBand(ctx, strand, samples) {
    const half = (/** @type {number} */ u) => (strand.width * this.#height * (0.86 + 0.14 * this.#facing(strand, u))) / 2;
    ctx.save();
    ctx.translate(0, this.#height * 0.05);
    this.#traceStrip(ctx, samples, (u) => half(u) * 1.08);
    ctx.fillStyle = "rgba(35, 4, 8, 0.32)";
    ctx.fill();
    ctx.restore();
    this.#traceStrip(ctx, samples, half);
    ctx.fillStyle = strand.color;
    ctx.fill();
  }

  /**
   * A silk ribbon that narrows and darkens where it twists edge-on. Shading is a gradient
   * along the ribbon, so it costs one fill per frame.
   * @param {CanvasRenderingContext2D} ctx @param {LiveStrand} strand @param {Sample[]} samples
   */
  #drawRibbon(ctx, strand, samples) {
    const palette = PALETTES[/** @type {keyof typeof PALETTES} */ (strand.color)] ?? PALETTES.cream;
    const upper = this.#traceStrip(ctx, samples, (u) => (strand.width * this.#height * (0.22 + 0.78 * this.#facing(strand, u))) / 2);

    const first = samples[0];
    const last = samples[samples.length - 1];
    const gradient = ctx.createLinearGradient(first[0], 0, Math.max(first[0] + 1, last[0]), 0);
    const stops = 18;
    for (let index = 0; index <= stops; index++) {
      const position = index / stops;
      const u = first[2] + (last[2] - first[2]) * position;
      // Blend between the three front colours across the ribbon, then toward the reverse side.
      const scaled = Math.min(Math.max((u - START_U) / SPAN_U, 0), 1) * (palette.front.length - 1);
      const lower = Math.floor(Math.min(scaled, palette.front.length - 2));
      const front = mix(palette.front[lower], palette.front[lower + 1], scaled - lower);
      const turned = (1 - this.#facing(strand, u)) ** 2 * 0.75;
      const [r, g, b] = mix(front, palette.back, turned);
      gradient.addColorStop(position, `rgb(${r} ${g} ${b})`);
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // A fine sheen along the upper edge reads as light catching the silk.
    ctx.beginPath();
    upper.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "rgba(255, 251, 242, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  render() {
    const { ctx } = this;
    if (!ctx || !this.#width || !this.#height) return;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, this.#width, this.#height);
    if (this.mirror) {
      ctx.translate(this.#width, this.#height);
      ctx.scale(-1, -1);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const strand of this.strands) {
      if (strand.reveal <= 0.001) continue;
      const samples = this.#samples(strand);
      if (strand.kind === "thread") this.#drawThread(ctx, strand, samples);
      else if (strand.kind === "band") this.#drawBand(ctx, strand, samples);
      else this.#drawRibbon(ctx, strand, samples);
    }
  }

  destroy() {
    gsap.ticker.remove(this.render);
    for (const animation of this.#animations) animation.kill();
    this.#observer?.disconnect();
  }
}

/**
 * Svelte attachment: `<canvas {@attach ribbons({ mirror: true })}>`.
 * @param {{ mirror?: boolean, seed?: number }} [options]
 * @returns {import("svelte/attachments").Attachment<HTMLCanvasElement>}
 */
export function ribbons(options) {
  return (canvas) => {
    const field = new RibbonField(canvas, options);
    return () => field.destroy();
  };
}
