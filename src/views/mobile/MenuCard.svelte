<script>
  /** @type {{ title: string, subtitle: string, onclick: () => void }} */
  let { title, subtitle, onclick } = $props();
</script>

<button class="card" type="button" {onclick}>
  <span class="text">
    <strong>{title}</strong>
    <span>{subtitle}</span>
  </span>
  <span class="chevron" aria-hidden="true"></span>
</button>

<style>
  .card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 18px 18px 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }

  .card:hover,
  .card:active {
    background: var(--surface-hover);
    border-color: var(--line-strong);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    font-size: 18px;
    font-weight: 650;
    color: var(--ink-strong);
  }

  .text span {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .chevron {
    width: 9px;
    height: 9px;
    flex: none;
    border-top: 2px solid var(--ink-muted);
    border-right: 2px solid var(--ink-muted);
    transform: rotate(45deg);
  }
</style>
