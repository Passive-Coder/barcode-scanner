import { gsap, prefersReducedMotion } from "../motion.js";

/** Bar widths in px; narrow bars are listed twice so they appear more often, as in real codes. */
const BAR_WIDTHS = [1.5, 1.5, 3, 3, 4.5];
const CORNER_IDLE = "#c99a92";
const CORNER_LOCKED = "#fff5e8";

const randomBar = () => BAR_WIDTHS[Math.floor(Math.random() * BAR_WIDTHS.length)];

/** A random EAN-13 with a valid check digit, spaced the way it is printed. */
export function randomEan13() {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  const code = [...digits, (10 - (sum % 10)) % 10].join("");
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}

/**
 * Svelte attachment for ScanArt: a scan line sweeps the code, the viewfinder locks on, a
 * "Scanned" badge pops, and the bars re-form into the next code. Each cycle builds a fresh
 * timeline so every code is different.
 * @returns {import("svelte/attachments").Attachment<HTMLElement>}
 */
export function barcodeLoop() {
  return (root) => {
    const barRow = root.querySelector(".bars");
    const bars = /** @type {HTMLElement[]} */ ([...root.querySelectorAll(".bars > span:not(.laser)")]);
    const digits = /** @type {HTMLElement} */ (root.querySelector(".digits"));
    const laser = root.querySelector(".laser");
    const corners = root.querySelectorAll(".corner");
    const badge = root.querySelector(".badge");

    for (const bar of bars) bar.style.width = `${randomBar()}px`;
    digits.textContent = randomEan13();
    gsap.set(badge, { xPercent: -50, yPercent: -50 });
    if (prefersReducedMotion()) return;

    /** @type {gsap.core.Timeline | undefined} */
    let current;
    const cycle = () => {
      const next = bars.map(randomBar);
      current = gsap
        .timeline({ onComplete: cycle })
        .set(laser, { top: "0%", opacity: 0 })
        .to(laser, { opacity: 1, duration: 0.2 })
        .to(laser, { top: "100%", duration: 0.8, ease: "sine.inOut" }, "<")
        .to(laser, { top: "0%", duration: 0.8, ease: "sine.inOut" })
        .to(laser, { opacity: 0, duration: 0.2 }, "-=0.15")
        // The viewfinder closes in on the code to show it has locked on.
        .to(corners, {
          x: (_, corner) => (corner.classList.contains("left") ? 5 : -5),
          y: (_, corner) => (corner.classList.contains("top") ? 4 : -4),
          borderColor: CORNER_LOCKED,
          duration: 0.3,
          ease: "back.out(2.5)",
        }, "-=0.1")
        .to([barRow, digits], { opacity: 0.3, duration: 0.25 }, "<")
        .fromTo(badge, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.2)" }, "<")
        .to(badge, { opacity: 0, scale: 0.9, duration: 0.25 }, "+=0.9")
        .to(barRow, { opacity: 1, duration: 0.3 }, "<")
        .to(corners, { x: 0, y: 0, borderColor: CORNER_IDLE, duration: 0.35, ease: "power2.out" }, "<")
        // The next code: bars resize outward from the middle while the digits change.
        .to(bars, { width: (index) => next[index], duration: 0.5, ease: "power2.inOut", stagger: { each: 0.012, from: "center" } }, "<")
        .to(digits, { opacity: 0, duration: 0.15 }, "<")
        .call(() => (digits.textContent = randomEan13()))
        .to(digits, { opacity: 1, duration: 0.25 })
        .to({}, { duration: 0.35 });
    };
    cycle();
    return () => current?.kill();
  };
}
