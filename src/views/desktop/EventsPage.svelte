<script>
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import EventDetail from "../../components/events/EventDetail.svelte";
  import EventList from "../../components/events/EventList.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";

  /** @param {string} id */
  const open = (id) => attempt(() => events.open(id), "Could not open the event");
</script>

<section aria-labelledby="events-heading">
  <SectionHeading
    title="Events"
    id="events-heading"
    description="Run an event with its people, sub-teams, Google Sheets and Docs, and alerts. Roles apply inside each event only."
  />
  {#if account.ready}
    <div class="layout">
      <aside><EventList onopen={open} /></aside>
      <div class="main">
        {#if events.selectedId}
          <EventDetail onclosed={() => events.close()} />
        {:else}
          <p class="placeholder">Choose an event, or create one.</p>
        {/if}
      </div>
    </div>
  {:else}
    <SignInPrompt what="your events" />
  {/if}
</section>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  aside {
    position: sticky;
    top: 84px;
  }

  .placeholder {
    margin: 0;
    padding: 40px 24px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--ink-muted);
    text-align: center;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }

    aside {
      position: static;
    }
  }
</style>
