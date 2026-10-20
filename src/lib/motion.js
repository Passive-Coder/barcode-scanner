import { gsap } from "gsap";

/**
 * GSAP-powered Svelte attachments. Every effect is skipped when the person prefers reduced
 * motion, and every tween is killed when its element unmounts.
 */
export const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fades an element (or each of its children) up into place when it mounts.
 * @param {{ y?: number, x?: number, duration?: number, delay?: number, stagger?: number, children?: boolean, ease?: string }} [options]
 * @returns {import("svelte/attachments").Attachment<HTMLElement>}
 */
export function enter({ y = 18, x = 0, duration = 0.6, delay = 0, stagger = 0, children = false, ease = "power3.out" } = {}) {
  return (node) => {
    if (prefersReducedMotion()) return;
    const tween = gsap.from(children ? node.children : node, { opacity: 0, y, x, duration, delay, stagger, ease, clearProps: "opacity,transform" });
    return () => tween.kill();
  };
}

export { gsap };
