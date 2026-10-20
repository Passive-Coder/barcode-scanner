<script>
  import { enter } from "$lib/motion.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import TeamDetail from "../../components/teams/TeamDetail.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";
  import MobileBar from "./MobileBar.svelte";

  const back = () => mobileNav.go("teams");
</script>

<div class="screen" {@attach enter({ y: 12, duration: 0.4 })}>
  <MobileBar title={teams.detail?.team.name ?? "Team"} subtitle="Team" backLabel="Back to teams" onback={back} />
  <SessionBanner />
  {#if account.ready}
    <TeamDetail onclosed={back} />
  {:else}
    <SignInPrompt what="this team" />
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

  .screen :global(article h2) {
    font-size: 20px;
  }
</style>
