<script>
  import { tick } from "svelte";
  import { gsap, prefersReducedMotion } from "$lib/motion.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";

  /**
   * The scanner menu that drops from the barcode logo: one link to the other scanner page
   * (Sheet settings, or back to the scanner from there) and Sign out.
   * @type {{ open: boolean, anchor?: HTMLElement }}
   */
  let { open = $bindable(), anchor } = $props();

  /** @type {HTMLDivElement | undefined} */
  let menu = $state();
  const onSettings = $derived(mobileNav.view === "sheet-settings");

  function close({ refocus = false } = {}) {
    open = false;
    if (refocus) anchor?.focus();
  }

  function navigate() {
    close();
    mobileNav.go(onSettings ? "workspace" : "sheet-settings");
  }

  function signOut() {
    close();
    workspace.signOut();
  }

  /** @type {import("svelte/attachments").Attachment<HTMLDivElement>} */
  const appear = (node) => {
    tick().then(() => /** @type {HTMLElement | null} */ (node.querySelector("[role=menuitem]"))?.focus());
    if (prefersReducedMotion()) return;
    const tween = gsap.from(node, { opacity: 0, y: -6, scale: 0.96, transformOrigin: "100% 0%", duration: 0.2, ease: "power2.out" });
    return () => tween.kill();
  };

  /** @param {PointerEvent} event */
  function onpointerdown(event) {
    const target = /** @type {Node} */ (event.target);
    if (open && !menu?.contains(target) && !anchor?.contains(target)) close();
  }

  /** @param {KeyboardEvent} event */
  function onkeydown(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close({ refocus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = /** @type {HTMLElement[]} */ ([...(menu?.querySelectorAll("[role=menuitem]") ?? [])]);
    const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
    event.preventDefault();
  }
</script>

<svelte:window {onpointerdown} {onkeydown} />

{#if open}
  <div class="menu" role="menu" aria-label="Scanner menu" bind:this={menu} {@attach appear}>
    <button type="button" role="menuitem" onclick={navigate}>
      <strong>{onSettings ? "Back to scanner" : "Sheet settings"}</strong>
      <span>{onSettings ? "Camera and latest scan" : "Spreadsheet, tab, and column mapping"}</span>
    </button>
    <button type="button" role="menuitem" class="danger" onclick={signOut}>
      <strong>Sign out</strong>
    </button>
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    top: calc(var(--safe-top) + 67px);
    right: calc(max(0px, (100vw - 560px) / 2) + 20px);
    z-index: 21;
    width: min(260px, calc(100vw - 40px));
    padding: 6px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--dialog-bg);
    box-shadow: 0 16px 40px #1d020a80;
  }

  button {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 11px 12px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--dialog-ink);
    text-align: left;
  }

  button:hover,
  button:focus-visible {
    background: var(--surface-hover);
    outline: none;
  }

  button + button {
    margin-top: 2px;
  }

  strong {
    font-size: 15px;
    font-weight: 600;
  }

  span {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .danger strong {
    color: var(--danger);
  }
</style>
