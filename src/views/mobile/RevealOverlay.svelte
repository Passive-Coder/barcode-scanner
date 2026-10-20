<script>
  import { onMount } from "svelte";
  import { gsap, prefersReducedMotion } from "$lib/motion.js";
  import CouncilMark from "../../components/brand/CouncilMark.svelte";

  /**
   * Plays after sign-in: the council figures assemble, the mark turns, the home screen appears
   * underneath (`onswap`), and the mark flies into the home header's logo button.
   * @type {{ onswap: () => void, ondone: () => void }}
   */
  let { onswap, ondone } = $props();

  /** @type {HTMLDivElement | undefined} */
  let overlay = $state();
  /** @type {HTMLDivElement | undefined} */
  let logo = $state();

  function flyToHeader() {
    const target = document.querySelector("[data-reveal-target]");
    if (!logo || !target) return;
    const from = logo.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    gsap.to(logo, {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / from.width,
      duration: 0.85,
      ease: "power3.inOut",
    });
  }

  onMount(() => {
    if (prefersReducedMotion() || !overlay || !logo) {
      onswap();
      ondone();
      return;
    }
    const figures = logo.querySelectorAll(".figure");
    gsap.set(figures, { opacity: 0, scale: 0.45, transformOrigin: "50% 50%" });
    const timeline = gsap
      .timeline({ onComplete: ondone })
      .to(figures[0], { opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.7)" })
      .to([...figures].slice(1), { opacity: 1, scale: 1, duration: 0.44, stagger: 0.16, ease: "back.out(1.5)" }, ">-.05")
      .fromTo(logo.querySelector(".people"), { rotation: -74, transformOrigin: "50% 50%" }, { rotation: 0, duration: 1.15, ease: "power3.out" }, "<")
      .to(logo, { rotation: 360, duration: 1.05, ease: "power3.inOut" }, ">+.12")
      .add(onswap)
      .to(overlay, { backgroundColor: "rgba(79, 8, 21, 0)", duration: 0.45 }, "<")
      .add(flyToHeader, ">")
      .to(overlay, { opacity: 0, duration: 0.3 }, ">+.78");
    return () => timeline.kill();
  });
</script>

<div class="overlay" bind:this={overlay} role="status" aria-label="Opening Linework">
  <div class="logo" bind:this={logo}><CouncilMark /></div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #4f0815;
    color: var(--ink);
    pointer-events: none;
  }

  .logo {
    width: min(38vw, 170px);
    height: min(38vw, 170px);
    display: grid;
    place-items: center;
  }
</style>
