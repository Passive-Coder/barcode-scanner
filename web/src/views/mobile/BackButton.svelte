<script>
  /** @type {{ label: string, onclick: () => void }} */
  let { label, onclick } = $props();
</script>

<button class="back" type="button" aria-label={label} {onclick}>←</button>

<style>
  .back {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: transparent;
    color: var(--ink);
    font-size: 20px;
    line-height: 1;
  }
</style>
