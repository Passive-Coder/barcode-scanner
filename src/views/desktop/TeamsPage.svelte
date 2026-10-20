<script>
  import { attempt } from "$lib/feedback.js";
  import { account } from "$lib/stores/account.svelte.js";
  import { teams } from "$lib/stores/teams.svelte.js";
  import TeamDetail from "../../components/teams/TeamDetail.svelte";
  import TeamList from "../../components/teams/TeamList.svelte";
  import SectionHeading from "../../components/ui/SectionHeading.svelte";
  import SignInPrompt from "../../components/ui/SignInPrompt.svelte";

  /** @param {string} id */
  const open = (id) => attempt(() => teams.open(id), "Could not open the team");
</script>

<section aria-labelledby="teams-heading">
  <SectionHeading title="Teams" id="teams-heading" description="Your own lists of people, like a Google Group. Add a whole team to an event or a sub-team at once." />
  {#if account.ready}
    <div class="layout">
      <aside><TeamList onopen={open} /></aside>
      <div class="main">
        {#if teams.selectedId}
          <TeamDetail />
        {:else}
          <p class="placeholder">Choose a team, or create one.</p>
        {/if}
      </div>
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
