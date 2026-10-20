<script>
  import { sheetLoop } from "$lib/illustrations/sheet-loop.js";
</script>

<!-- Spans throughout, because this sits inside a <button>. Rows are created by sheetLoop. -->
<span class="art" aria-hidden="true" {@attach sheetLoop()}>
  <span class="page">
    <span class="fold"></span>
    <span class="title"></span>
    <span class="head"><span class="cell"><i></i></span><span class="cell"><i></i></span><span class="cell"><i></i></span></span>
    <span class="rows"></span>
  </span>
  <span class="chip"><span class="dot"></span><span class="chip-text"></span></span>
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

  /* A spreadsheet page with a folded corner, like the Docs and Sheets icons. */
  .page {
    position: relative;
    display: block;
    width: 138px;
    height: 108px;
    padding: 12px 11px 0;
    overflow: hidden;
    border-radius: 6px;
    background: #fff6e8;
    clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
    box-shadow: 0 10px 24px #1d020a66;
  }

  .fold {
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 20px;
    border-bottom-left-radius: 4px;
    background: linear-gradient(to bottom left, transparent 50%, #e3cdb1 50%);
  }

  .title {
    display: block;
    width: 46%;
    height: 5px;
    margin-bottom: 9px;
    border-radius: 3px;
    background: #d8c1a6;
  }

  .head,
  .rows :global(.row) {
    display: grid;
    grid-template-columns: 1.25fr 1fr 0.85fr;
    gap: 4px;
    height: 10px;
    margin-bottom: 4px;
    border-radius: 2px;
  }

  .rows {
    display: block;
  }

  .rows :global(.row) {
    overflow: hidden;
  }

  .cell,
  .rows :global(.cell) {
    display: flex;
    align-items: center;
    padding: 0 2px;
    border-radius: 2px;
  }

  .cell i,
  .rows :global(.cell i) {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: #d6bfa6;
  }

  .head .cell i {
    width: 70%;
    background: #8e1f31;
  }

  .chip {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px 3px 7px;
    border-radius: 999px;
    background: #f8ebd9;
    color: #5a0d1b;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #2f8a52;
  }
</style>
