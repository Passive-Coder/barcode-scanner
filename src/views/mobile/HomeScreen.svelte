<script>
  import { untrack } from "svelte";
  import { enter } from "$lib/motion.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import Ribbons from "../../components/brand/Ribbons.svelte";
  import ScanArt from "../../components/illustrations/ScanArt.svelte";
  import SheetArt from "../../components/illustrations/SheetArt.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import MenuCard from "./MenuCard.svelte";

  // The sign-in reveal animates its own entrance, so only animate when arriving normally.
  const intro = untrack(() => mobileNav.revealing) ? undefined : enter({ y: 14, duration: 0.45, stagger: 0.06, children: true });
</script>

<section class="home" aria-labelledby="home-title">
  <div class="inner" {@attach intro}>
    <!-- The account logo is pinned in the corner by MobileApp (HeaderLogo). -->
    <header>
      <h1 id="home-title">Hi {auth.displayName}</h1>
    </header>

    <SessionBanner />

    <p>What would you like to do?</p>
    <div class="menu">
      <MenuCard title="Scan barcodes" subtitle="Use the camera or a photo, and record each scan to a sheet." onclick={() => mobileNav.choose("scan")}>
        {#snippet art()}<ScanArt />{/snippet}
      </MenuCard>
      <MenuCard title="Edit a spreadsheet" subtitle="View and change rows, columns, and tabs." onclick={() => mobileNav.choose("edit")}>
        {#snippet art()}<SheetArt />{/snippet}
      </MenuCard>
    </div>
  </div>
  <Ribbons position="bottom" />
</section>

<style>
  .home {
    --ribbon-height: clamp(130px, 22svh, 220px);
    position: relative;
    isolation: isolate;
    min-height: 100svh;
    padding-bottom: calc(var(--ribbon-height) * 0.75);
    overflow: hidden;
  }

  .inner {
    max-width: 560px;
    margin: auto;
    padding: var(--safe-top) 20px 24px;
  }

  /* Same height as the other screens' top bar, so the pinned logo lines up with the greeting. */
  header {
    min-height: 72px;
    display: flex;
    align-items: center;
    padding-right: 58px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
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
    gap: 12px;
  }
</style>
