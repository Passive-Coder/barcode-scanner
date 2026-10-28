<script>
  import { onMount } from "svelte";
  import { gsap, prefersReducedMotion } from "$lib/motion.js";
  import CouncilMark from "../../components/brand/CouncilMark.svelte";

  /**
   * Plays after sign-in: the five figures spin into place, the mark turns one step, the home
   * screen appears underneath (`onswap`), and the mark glides into the home header's logo.
   *
   * Kept smooth and crisp by animating the SVG's own transforms (re-rendered as vectors every
   * frame), fading with opacity rather than repainting a full-screen colour, and moving the
   * mark only with compositor-friendly transforms.
   * @type {{ onswap: () => void, ondone: () => void }}
   */
  let { onswap, ondone } = $props();

  /** @type {HTMLDivElement | undefined} */
  let backdrop = $state();
  /** @type {HTMLDivElement | undefined} */
  let logo = $state();

  /** Where the header logo's mark sits, relative to the overlay mark's current box. */
  function target() {
    const destination = document.querySelector("[data-reveal-target] svg");
    if (!logo || !destination) return { x: 0, y: 0, scale: 1 };
    const from = logo.getBoundingClientRect();
    const to = destination.getBoundingClientRect();
    return {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / from.width,
    };
  }

  onMount(() => {
    if (prefersReducedMotion() || !backdrop || !logo) {
      onswap();
      ondone();
      return;
    }
    const people = logo.querySelector(".people");
    const figures = logo.querySelectorAll(".figure");
    /** @type {{ x: number, y: number, scale: number } | undefined} */
    let flight;
    // Measured once, when the glide starts, after the home screen has rendered.
    const fly = () => (flight ??= target());

    gsap.set(figures, { opacity: 0, scale: 0.35, transformOrigin: "50% 50%" });
    gsap.set(people, { rotation: -110, svgOrigin: "0 0" });

    const timeline = gsap
      .timeline({ onComplete: ondone })
      .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0)
      .to(people, { rotation: 0, duration: 1.5, ease: "expo.out" }, 0.1)
      .to(figures, { opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.3)", stagger: 0.08 }, 0.12)
      // One 72° step lands on an identical pose, so the mark matches the header's when it arrives.
      .to(people, { rotation: 72, duration: 0.85, ease: "power2.inOut" }, 1.6)
      .add(onswap)
      // A short hold lets the home screen render before anything moves again.
      .to(backdrop, { opacity: 0, duration: 0.6, ease: "power1.inOut" }, "+=0.12")
      .to(logo, { x: () => fly().x, y: () => fly().y, scale: () => fly().scale, duration: 0.85, ease: "power3.inOut" }, "<");

    return () => timeline.kill();
  });
</script>

<div class="overlay" aria-hidden="true">
  <div class="backdrop" bind:this={backdrop}></div>
  <div class="logo" bind:this={logo}><CouncilMark /></div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: var(--bg);
  }

  .logo {
    position: relative;
    width: min(40vw, 176px);
    height: min(40vw, 176px);
    color: var(--ink);
    will-change: transform;
  }
</style>
