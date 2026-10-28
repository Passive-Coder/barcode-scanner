<script>
  import { enter } from "$lib/motion.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import EventDetail from "../../components/events/EventDetail.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";
  import MobileBar from "./MobileBar.svelte";

  function back() {
    events.close();
    mobileNav.go("events");
  }
</script>

<div class="screen" {@attach enter({ y: 12, duration: 0.4 })}>
  <!-- The event's name is the page's own heading, where it has room to wrap. -->
  <MobileBar title="Event" backLabel="Back to events" onback={back} />
  <SessionBanner />
  {#if account.ready}
    <EventDetail onclosed={back} />
  {:else}
    <SignInPrompt what="this event" />
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

  .screen :global(.detail h2) {
    font-size: 22px;
  }
</style>
