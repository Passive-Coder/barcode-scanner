<script>
  import { timeAgo } from "$lib/format.js";
  import { prefersReducedMotion } from "$lib/motion.js";
  import { alerts } from "$lib/stores/alerts.svelte.js";

  /**
   * A page fills the screen until it's acknowledged: the way an organizer or sub-team manager
   * gets everyone's attention at once. Several pages are shown one after another.
   */
  const page = $derived(alerts.pages[0] ?? null);
  const total = $derived(alerts.pages.length);
  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state();
  /** @type {HTMLButtonElement | undefined} */
  let acknowledgeButton = $state();
  let announced = "";

  $effect(() => {
    if (!dialog) return;
    if (page && !dialog.open) dialog.showModal();
    else if (!page && dialog.open) dialog.close();
  });

  // Each new page buzzes and beeps once, where the browser allows it.
  $effect(() => {
    const id = page?.id;
    if (!id || id === announced) return;
    announced = id;
    acknowledgeButton?.focus();
    const active = navigator.userActivation?.hasBeenActive ?? true;
    if (!active) return;
    navigator.vibrate?.([400, 160, 400, 160, 400]);
    beep();
  });

  function beep() {
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.value = 0.18;
      for (let index = 0; index < 3; index++) {
        const tone = context.createOscillator();
        tone.type = "sine";
        tone.frequency.value = 880;
        tone.connect(gain);
        tone.start(context.currentTime + index * 0.35);
        tone.stop(context.currentTime + index * 0.35 + 0.2);
      }
      setTimeout(() => context.close(), 1500);
    } catch {
      /* Sound is a bonus; the screen already shows the page. */
    }
  }
</script>

<!-- A page must be acknowledged, so Escape doesn't dismiss it. -->
<dialog
  bind:this={dialog}
  class={["page", !prefersReducedMotion() && "animated"]}
  aria-labelledby="page-title"
  aria-describedby="page-body"
  oncancel={(event) => event.preventDefault()}
>
  {#if page}
    <div class="inner">
      <p class="context">
        {page.senderName || page.senderEmail} · {page.eventName}
        {#if total > 1}· 1 of {total}{/if}
      </p>
      <h1 id="page-title">{page.title}</h1>
      {#if page.body}<p class="body" id="page-body">{page.body}</p>{:else}<p class="body" id="page-body">Sent to {page.audienceLabel}.</p>{/if}
      <p class="time">{timeAgo(page.createdAt)}</p>
      <button bind:this={acknowledgeButton} type="button" class="acknowledge" onclick={() => alerts.acknowledge(page.id)}>Acknowledge</button>
    </div>
  {/if}
</dialog>

<style>
  .page {
    width: 100vw;
    max-width: none;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: #6e0b1d;
    color: #fff5e8;
  }

  .page::backdrop {
    background: #2a0109;
  }

  /* A slow pulse between two wine tones, so a page is noticeable from across a room. */
  .page.animated {
    animation: pulse 1.6s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      background: #6e0b1d;
    }
    to {
      background: #8f1328;
    }
  }

  .inner {
    box-sizing: border-box;
    min-height: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: calc(48px + var(--safe-top)) 24px calc(32px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
  }

  .context {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffd9cf;
    overflow-wrap: anywhere;
  }

  h1 {
    color: #fff5e8;
    font-size: clamp(34px, 8vw, 64px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .body {
    margin: 0;
    font-size: clamp(18px, 3.4vw, 24px);
    line-height: 1.4;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .time {
    margin: 0;
    font-size: 15px;
    color: #ffd9cf;
  }

  .acknowledge {
    align-self: stretch;
    min-height: 64px;
    margin-top: 24px;
    border: 0;
    border-radius: 14px;
    background: #fff5e8;
    color: #5a0d1b;
    font-size: 20px;
    font-weight: 700;
  }

  .acknowledge:focus-visible {
    outline: 3px solid #fff5e8;
    outline-offset: 4px;
  }

  @media (min-width: 701px) {
    .acknowledge {
      align-self: start;
      min-width: 280px;
    }
  }
</style>
