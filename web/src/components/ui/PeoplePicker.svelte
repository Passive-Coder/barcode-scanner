<script>
  import { displayName } from "$lib/people.js";

  /**
   * A searchable checklist of people. With `managers`, each chosen person can also be marked
   * as a manager.
   * @type {{
   *   people: Array<{ email: string, name: string }>,
   *   selected: string[],
   *   managers?: string[],
   *   label: string,
   *   disabled?: boolean,
   * }}
   */
  let { people, selected = $bindable(), managers = $bindable(), label, disabled = false } = $props();

  const id = $props.id();
  let query = $state("");
  const filtered = $derived.by(() => {
    const term = query.trim().toLowerCase();
    return term ? people.filter((person) => person.email.includes(term) || person.name.toLowerCase().includes(term)) : people;
  });
  const allShown = $derived(filtered.length > 0 && filtered.every((person) => selected.includes(person.email)));

  /** @param {string} email @param {boolean} on */
  function toggle(email, on) {
    selected = on ? [...new Set([...selected, email])] : selected.filter((item) => item !== email);
    if (!on && managers) managers = managers.filter((item) => item !== email);
  }

  /** @param {string} email @param {boolean} on */
  function toggleManager(email, on) {
    if (!managers) return;
    managers = on ? [...new Set([...managers, email])] : managers.filter((item) => item !== email);
    if (on) toggle(email, true);
  }

  function toggleAll() {
    const emails = filtered.map((person) => person.email);
    if (allShown) {
      selected = selected.filter((email) => !emails.includes(email));
      if (managers) managers = managers.filter((email) => !emails.includes(email));
    } else {
      selected = [...new Set([...selected, ...emails])];
    }
  }
</script>

<fieldset class="picker" {disabled}>
  <legend class="field-label">{label}</legend>
  <div class="tools">
    <input class="input" type="search" placeholder="Search people" aria-label="Search people" bind:value={query} />
    <button type="button" class="all" disabled={!filtered.length} onclick={toggleAll}>{allShown ? "Clear" : "Select all"}</button>
  </div>
  <p class="summary" id="{id}-summary">{selected.length} of {people.length} selected</p>
  {#if filtered.length}
    <ul aria-describedby="{id}-summary">
      {#each filtered as person (person.email)}
        <li>
          <label class="person">
            <input type="checkbox" checked={selected.includes(person.email)} onchange={(event) => toggle(person.email, event.currentTarget.checked)} />
            <span class="who">
              <span class="name">{displayName(person)}</span>
              {#if person.name}<span class="email">{person.email}</span>{/if}
            </span>
          </label>
          {#if managers}
            <label class="manager">
              <input type="checkbox" checked={managers.includes(person.email)} onchange={(event) => toggleManager(person.email, event.currentTarget.checked)} />
              Manager
            </label>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-note">{people.length ? "No one matches that search." : "No people to choose from yet."}</p>
  {/if}
</fieldset>

<style>
  .picker {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 6px;
    padding: 0;
  }

  .tools {
    display: flex;
    gap: 8px;
  }

  .all {
    flex: none;
    padding: 0 12px;
    border: 1px solid var(--secondary-border);
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 13px;
    font-weight: 600;
  }

  .summary {
    margin: 6px 0;
    font-size: 12px;
    opacity: 0.75;
  }

  ul {
    max-height: 260px;
    margin: 0;
    padding: 0;
    overflow: auto;
    border: 1px solid var(--dialog-line);
    border-radius: var(--radius-sm);
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 10px;
  }

  li + li {
    border-top: 1px solid var(--dialog-line);
  }

  .person {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    cursor: pointer;
  }

  .who {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .email {
    font-size: 12px;
    opacity: 0.75;
    overflow-wrap: anywhere;
  }

  .manager {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }
</style>
