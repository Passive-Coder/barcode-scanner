<script>
  import { MediaQuery } from "svelte/reactivity";
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { events } from "$lib/stores/events.svelte.js";
  import EventDetail from "../../components/events/EventDetail.svelte";
  import EventList from "../../components/events/EventList.svelte";
  import Button from "../../components/ui/Button.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";

  /** Too narrow for the list and the event side by side: show one at a time. */
  const single = new MediaQuery("(max-width: 1000px)");

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
    <div class={["layout", single.current && "single"]}>
      {#if !single.current || !events.selectedId}
        <aside><EventList onopen={open} /></aside>
      {/if}
      {#if !single.current || events.selectedId}
        <div class="main">
          {#if events.selectedId}
            {#if single.current}
              <div class="back"><Button variant="quiet" onclick={() => events.close()}>← All events</Button></div>
            {/if}
            <EventDetail onclosed={() => events.close()} />
          {:else}
            <p class="placeholder">Choose an event, or create one.</p>
          {/if}
        </div>
      {/if}
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

  .layout.single {
    grid-template-columns: minmax(0, 1fr);
  }

  aside {
    position: sticky;
    top: 84px;
  }

  .single aside {
    position: static;
  }

  .back {
    margin: -8px 0 8px;
  }

  .placeholder {
    margin: 0;
    padding: 40px 24px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--ink-muted);
    text-align: center;
  }
</style>
