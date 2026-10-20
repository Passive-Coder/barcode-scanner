<script>
  import { untrack } from "svelte";
  import { enter } from "$lib/motion.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { dialogs } from "$lib/stores/dialogs.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import CouncilMark from "../../components/brand/CouncilMark.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import MenuCard from "./MenuCard.svelte";

  // The sign-in reveal animates its own entrance, so only animate when arriving normally.
  const intro = untrack(() => mobileNav.revealing) ? undefined : enter({ y: 14, duration: 0.45 });
</script>

<section class="home" aria-labelledby="home-title">
  <div class="inner" {@attach intro}>
    <header>
      <h1 id="home-title">Hi {auth.displayName}</h1>
      <button class={["logo", mobileNav.revealing && "hidden"]} type="button" aria-label="Account" data-reveal-target onclick={() => (dialogs.accountOpen = true)}>
        <CouncilMark />
      </button>
    </header>

    <SessionBanner />

    <p>What would you like to do?</p>
    <div class="menu">
      <MenuCard title="Scan barcodes" subtitle="Use the camera or a photo, and record each scan to a sheet." onclick={() => mobileNav.choose("scan")} />
      <MenuCard title="Edit a spreadsheet" subtitle="View and change rows, columns, and tabs." onclick={() => mobileNav.choose("edit")} />
    </div>
  </div>
</section>

<style>
  .inner {
    max-width: 560px;
    min-height: 100svh;
    margin: auto;
    padding: calc(24px + var(--safe-top)) 20px calc(24px + var(--safe-bottom));
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }

  .logo {
    width: 52px;
    height: 52px;
    flex: none;
    display: grid;
    place-items: center;
    padding: 6px;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: transparent;
    color: var(--ink);
    transition: background 0.2s, opacity 0.2s;
  }

  .logo:hover,
  .logo:active {
    background: var(--surface-hover);
  }

  .logo.hidden {
    opacity: 0;
  }

  .inner > :global(.banner) {
    margin-bottom: 20px;
  }

  p {
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--ink-muted);
  }

  .menu {
    display: grid;
    gap: 10px;
  }
</style>
