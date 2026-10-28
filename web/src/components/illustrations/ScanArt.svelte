<script>
  import { barcodeLoop } from "$lib/illustrations/barcode-loop.js";

  const BAR_COUNT = 30;
</script>

<!-- Spans throughout, because this sits inside a <button>. -->
<span class="art" aria-hidden="true" {@attach barcodeLoop()}>
  <span class="finder">
    <span class="corner top left"></span>
    <span class="corner top right"></span>
    <span class="corner bottom left"></span>
    <span class="corner bottom right"></span>
    <span class="code">
      <span class="bars">
        {#each { length: BAR_COUNT }, index (index)}<span></span>{/each}
        <span class="laser"></span>
      </span>
      <span class="digits"></span>
    </span>
  </span>
</span>

<style>
  .art {
    position: relative;
    display: grid;
    place-items: center;
    height: 132px;
    overflow: hidden;
    border-radius: 8px;
    background: #4a0714;
  }

  .finder {
    position: relative;
    display: block;
    padding: 14px 22px 10px;
  }

  .corner {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 0 solid #c99a92;
  }

  .top {
    top: 0;
  }

  .bottom {
    bottom: 0;
  }

  .left {
    left: 0;
  }

  .right {
    right: 0;
  }

  .top.left {
    border-width: 2px 0 0 2px;
    border-top-left-radius: 4px;
  }

  .top.right {
    border-width: 2px 2px 0 0;
    border-top-right-radius: 4px;
  }

  .bottom.left {
    border-width: 0 0 2px 2px;
    border-bottom-left-radius: 4px;
  }

  .bottom.right {
    border-width: 0 2px 2px 0;
    border-bottom-right-radius: 4px;
  }

  .code {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .bars {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: 58px;
    padding: 0 4px;
  }

  .bars > span:not(.laser) {
    display: block;
    width: 2px;
    border-radius: 0.5px;
    background: #f8ebd9;
  }

  .laser {
    position: absolute;
    left: -10px;
    right: -10px;
    top: 0;
    height: 2px;
    border-radius: 2px;
    background: #ffc2ae;
    opacity: 0;
  }

  .digits {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    color: #e0bfb2;
  }
</style>
