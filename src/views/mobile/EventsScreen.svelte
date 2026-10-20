<script>
  import { attempt } from "$lib/feedback.js";
  import { enter } from "$lib/motion.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import { mobileNav } from "$lib/stores/layout.svelte.js";
  import EventList from "../../components/events/EventList.svelte";
  import SessionBanner from "../../components/ui/SessionBanner.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";
  import MobileBar from "./MobileBar.svelte";

  /** @param {string} id */
  async function open(id) {
    mobileNav.go("event");
    await attempt(() => events.open(id), "Could not open the event");
  }
</script>

<div class="screen" {@attach enter({ y: 12, duration: 0.4 })}>
  <MobileBar title="Events" backLabel="Back to home" onback={() => mobileNav.go("home")} />
  <SessionBanner />
  {#if account.ready}
    <EventList onopen={open} />
  {:else}
    <SignInPrompt what="your events" />
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
