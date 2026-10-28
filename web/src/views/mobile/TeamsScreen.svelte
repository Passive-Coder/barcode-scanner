<script>
  import { attempt } from "$lib/feedback.js";
  import { enter } from "$lib/motion.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import TeamList from "../../components/teams/TeamList.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";
  import MobileBar from "./MobileBar.svelte";

  /** @param {string} id */
  async function open(id) {
    mobileNav.go("team");
    await attempt(() => teams.open(id), "Could not open the team");
  }
</script>

<div class="screen" {@attach enter({ y: 12, duration: 0.4 })}>
  <MobileBar title="Teams" backLabel="Back to home" onback={() => mobileNav.go("home")} />
  <SessionBanner />
  {#if account.ready}
    <TeamList onopen={open} />
  {:else}
    <SignInPrompt what="your teams" />
  {/if}
</div>

<style>
  .screen {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 20px calc(32px + var(--safe-bottom));
  }

  .screen > :global(.banner) {
    margin-bottom: 16px;
  }
</style>
