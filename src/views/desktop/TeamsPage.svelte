<script>
  import { MediaQuery } from "svelte/reactivity";
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import TeamDetail from "../../components/teams/TeamDetail.svelte";
  import TeamList from "../../components/teams/TeamList.svelte";
  import Button from "../../components/ui/Button.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";

  /** Too narrow for the list and the team side by side: show one at a time. */
  const single = new MediaQuery("(max-width: 1000px)");

  /** @param {string} id */
  const open = (id) => attempt(() => teams.open(id), "Could not open the team");
</script>

<section aria-labelledby="teams-heading">
  <SectionHeading title="Teams" id="teams-heading" description="Your own lists of people, like a Google Group. Add a whole team to an event or a sub-team at once." />
  {#if account.ready}
    <div class={["layout", single.current && "single"]}>
      {#if !single.current || !teams.selectedId}
        <aside><TeamList onopen={open} /></aside>
      {/if}
      {#if !single.current || teams.selectedId}
        <div class="main">
          {#if teams.selectedId}
            {#if single.current}
              <div class="back"><Button variant="quiet" onclick={() => teams.close()}>← All teams</Button></div>
            {/if}
            <TeamDetail onclosed={() => teams.close()} />
          {:else}
            <p class="placeholder">Choose a team, or create one.</p>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <SignInPrompt what="your teams" />
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
