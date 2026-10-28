import { gsap, prefersReducedMotion } from "./motion.js";

/** Corner radius of the logo tile: a circle as the council mark, a rounded square as a barcode. */
const RADIUS = { mark: 23, barcode: 12 };

/**
 * Morphs the header logo between the council mark and its barcode form.
 *
 * To barcode: the figures spin and collapse into the centre, the circle squares off, bars grow
 * outward from the middle, and a scan line sweeps them once. To mark: the bars fold away from
 * the edges in, and the figures spin back out. Pass `animate: false` to jump straight there.
 *
 * @param {HTMLElement} root the logo button holding `.council-mark` and `.barcode-glyph`
 * @param {"mark" | "barcode"} style
 * @param {{ animate: boolean }} options
 */
export function morphLogo(root, style, { animate }) {
  const people = root.querySelector(".council-mark .people");
  const figures = root.querySelectorAll(".council-mark .figure");
  const bars = root.querySelectorAll(".barcode-glyph .bar");
  const sweep = root.querySelector(".barcode-glyph .sweep");
  const targets = [root, people, sweep, ...figures, ...bars].filter(Boolean);
  gsap.killTweensOf(targets);

  const toBarcode = style === "barcode";
  gsap.set(figures, { transformOrigin: "50% 50%" });
  gsap.set(bars, { transformOrigin: "50% 50%" });
  gsap.set(people, { svgOrigin: "0 0" });

  if (!animate || prefersReducedMotion()) {
    gsap.set(people, { rotation: 0 });
    gsap.set(figures, { opacity: toBarcode ? 0 : 1, scale: toBarcode ? 0.2 : 1 });
    gsap.set(bars, { opacity: toBarcode ? 1 : 0, scaleY: toBarcode ? 1 : 0 });
    gsap.set(sweep, { opacity: 0 });
    gsap.set(root, { borderRadius: RADIUS[style] });
    return undefined;
  }

  const timeline = gsap.timeline();
  if (toBarcode) {
    timeline
      .to(people, { rotation: 72, duration: 0.5, ease: "power2.in" }, 0)
      .to(figures, { scale: 0.2, opacity: 0, duration: 0.42, ease: "power2.in", stagger: 0.04 }, 0)
      .to(root, { borderRadius: RADIUS.barcode, duration: 0.45, ease: "power2.inOut" }, 0.15)
      .fromTo(bars, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.45, ease: "back.out(2)", stagger: { each: 0.035, from: "center" } }, 0.38)
      .fromTo(sweep, { attr: { y: -34 }, opacity: 0 }, { attr: { y: 32 }, opacity: 1, duration: 0.55, ease: "sine.inOut" }, 0.85)
      .to(sweep, { opacity: 0, duration: 0.2 }, ">-0.12")
      // Reset the hidden mark so the way back starts from its resting pose.
      .set(people, { rotation: 0 });
  } else {
    timeline
      .to(bars, { scaleY: 0, opacity: 0, duration: 0.3, ease: "power2.in", stagger: { each: 0.03, from: "edges" } }, 0)
      .to(sweep, { opacity: 0, duration: 0.15 }, 0)
      .to(root, { borderRadius: RADIUS.mark, duration: 0.45, ease: "power2.inOut" }, 0.1)
      .fromTo(people, { rotation: -72 }, { rotation: 0, duration: 0.75, ease: "power3.out" }, 0.25)
      .to(figures, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.05 }, 0.25);
  }
  return timeline;
}
