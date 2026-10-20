<script>
  import { errorMessage } from "$lib/format.js";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { toast } from "$lib/stores/toast.svelte.js";
  import { workspace } from "$lib/stores/workspace.svelte.js";
  import CouncilMark from "../../components/brand/CouncilMark.svelte";
  import GoogleGlyph from "../../components/brand/GoogleGlyph.svelte";
  import Ribbons from "../../components/brand/Ribbons.svelte";

  /** @type {{ onsignedin: () => void }} */
  let { onsignedin } = $props();

  const busy = $derived(auth.status === "connecting");

  async function signIn() {
    try {
      await workspace.connect();
    } catch (error) {
      console.error("Google sign-in failed", error);
      toast.error(errorMessage(error));
    }
    if (auth.connected) onsignedin();
  }
</script>

<section class="welcome" aria-labelledby="welcome-title">
  <Ribbons position="top" />
  <div class="content">
    <div class="mark"><CouncilMark label="Student Council" /></div>
    <h1 id="welcome-title">Linework</h1>
    <p>Scan barcodes and record them straight into Google Sheets.</p>
    <button class="google" type="button" disabled={busy} aria-busy={busy || undefined} onclick={signIn}>
      <GoogleGlyph />
      <span>{busy ? "Connecting…" : "Continue with Google"}</span>
    </button>
    <a class="privacy" href="/privacy.html">Privacy policy</a>
  </div>
  <Ribbons position="bottom" />
</section>

<style>
  .welcome {
    position: relative;
    isolation: isolate;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(150px, 27svh, 280px) 24px;
    overflow: hidden;
    background: var(--bg);
    text-align: center;
  }

  .content {
    width: min(100%, 360px);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .mark {
    width: 56px;
    height: 56px;
    margin-bottom: 18px;
    color: #f2d8c2;
  }

  h1 {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }

  p {
    max-width: 280px;
    margin: 10px 0 28px;
    font-size: 16px;
    color: var(--ink-muted);
  }

  .google {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--radius);
    background: #fff8ee;
    color: #3b1a20;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 8px 24px #1d020a40;
    transition: transform 0.15s;
  }

  .google:active {
    transform: scale(0.98);
  }

  .privacy {
    margin-top: 16px;
    font-size: 13px;
    color: var(--ink-muted);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
