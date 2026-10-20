import { gsap, prefersReducedMotion } from "../motion.js";

const ROW_HEIGHT = 10;
const ROW_GAP = 4;
/** Soft tints on the paper, matching how Sheets highlights changes, in the app's warm palette. */
const TINTS = { add: "#cfe9d6", update: "#f6dcae", remove: "#f3b3aa" };
const CLEAR = "rgba(255, 246, 232, 0)";
const LABELS = { add: "Row added", update: "Cell updated", remove: "Row deleted" };
/** The chip's status dot: green for added, amber for edited, red for deleted. */
const DOTS = { add: "#2f8a52", update: "#c98a1c", remove: "#c2463a" };

/** @param {number} min @param {number} max */
const between = (min, max) => Math.round(min + Math.random() * (max - min));

/** A row of three cells, each holding a text-like bar. Built here because the loop adds rows. */
function makeRow() {
  const row = document.createElement("span");
  row.className = "row";
  for (const width of [between(55, 92), between(35, 85), between(40, 75)]) {
    const cell = document.createElement("span");
    cell.className = "cell";
    const bar = document.createElement("i");
    bar.style.width = `${width}%`;
    cell.append(bar);
    row.append(cell);
  }
  return row;
}

/**
 * Svelte attachment for SheetArt: rows are added, edited, and deleted on a small spreadsheet
 * page, each change tinted briefly and named in a chip, the way a live sheet would show it.
 * @returns {import("svelte/attachments").Attachment<HTMLElement>}
 */
export function sheetLoop() {
  return (root) => {
    const rows = /** @type {HTMLElement} */ (root.querySelector(".rows"));
    const chip = /** @type {HTMLElement} */ (root.querySelector(".chip"));
    const chipText = /** @type {HTMLElement} */ (chip.querySelector(".chip-text"));
    const chipDot = /** @type {HTMLElement} */ (chip.querySelector(".dot"));
    rows.replaceChildren(makeRow(), makeRow(), makeRow());
    if (prefersReducedMotion()) return;

    const sequence = /** @type {const} */ (["add", "update", "remove", "update"]);
    let step = 0;
    /** @type {gsap.core.Timeline | undefined} */
    let current;

    /** @param {gsap.core.Timeline} timeline @param {keyof typeof LABELS} action */
    const announce = (timeline, action) =>
      timeline
        .call(() => {
          chipText.textContent = LABELS[action];
          chipDot.style.background = DOTS[action];
        }, undefined, 0)
        .fromTo(chip, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "back.out(2)" }, 0)
        .to(chip, { opacity: 0, y: -6, duration: 0.25 }, 1.6);

    const cycle = () => {
      const action = sequence[step++ % sequence.length];
      const timeline = gsap.timeline({ delay: 0.6, onComplete: cycle });
      const present = /** @type {HTMLElement[]} */ ([...rows.children]);

      if (action === "add") {
        const row = makeRow();
        rows.append(row);
        timeline
          .fromTo(row, { height: 0, marginBottom: 0, opacity: 0, backgroundColor: TINTS.add }, { height: ROW_HEIGHT, marginBottom: ROW_GAP, opacity: 1, duration: 0.45, ease: "power2.out" }, 0)
          .to(row, { backgroundColor: CLEAR, duration: 0.9 }, 1.1);
      } else if (action === "update") {
        const cell = /** @type {HTMLElement} */ (present[between(0, present.length - 1)].children[between(0, 2)]);
        timeline
          .set(cell, { backgroundColor: TINTS.update }, 0)
          .to(cell.querySelector("i"), { width: `${between(30, 92)}%`, duration: 0.5, ease: "power2.inOut" }, 0.15)
          .to(cell, { backgroundColor: CLEAR, duration: 0.9 }, 1.1);
      } else {
        const row = present[0];
        timeline
          .to(row, { backgroundColor: TINTS.remove, duration: 0.2 }, 0)
          .to(row, { height: 0, marginBottom: 0, opacity: 0, duration: 0.45, ease: "power2.in" }, 0.7)
          .call(() => row.remove());
      }
      announce(timeline, action);
      current = timeline;
    };
    cycle();
    return () => current?.kill();
  };
}
