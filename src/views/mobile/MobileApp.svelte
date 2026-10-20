<script>
  import { untrack } from "svelte";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import AccountDialog from "../../components/settings/AccountDialog.svelte";
  import ChooseSheetScreen from "./ChooseSheetScreen.svelte";
  import HomeScreen from "./HomeScreen.svelte";
  import RevealOverlay from "./RevealOverlay.svelte";
  import WelcomeScreen from "./WelcomeScreen.svelte";
  import WorkspaceScreen from "./WorkspaceScreen.svelte";

  // Arriving signed in (for example after widening then narrowing the window) skips the welcome.
  if (untrack(() => auth.status !== "signed-out" && mobileNav.view === "welcome")) mobileNav.view = "home";

  // Signing out from anywhere returns to the welcome screen. An expired session stays put and
  // shows a reconnect banner instead, so in-progress work isn't lost.
  $effect(() => {
    if (auth.status === "signed-out" && mobileNav.view !== "welcome" && !mobileNav.revealing) mobileNav.go("welcome");
  });
</script>

<div class="mobile">
  {#if mobileNav.view === "welcome"}
    <WelcomeScreen onsignedin={() => (mobileNav.revealing = true)} />
  {:else if mobileNav.view === "home"}
    <HomeScreen />
  {:else if mobileNav.view === "choose"}
    <ChooseSheetScreen />
  {:else}
    <WorkspaceScreen />
  {/if}
</div>

{#if mobileNav.revealing}
  <RevealOverlay onswap={() => mobileNav.go("home")} ondone={() => (mobileNav.revealing = false)} />
{/if}

<AccountDialog />

<style>
  .mobile {
    min-height: 100svh;
    background: var(--bg);
    color: var(--ink);
  }
</style>
