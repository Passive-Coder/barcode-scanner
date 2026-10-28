import { tick } from "svelte";
import { desktopNav, mobileLayout, mobileNav } from "./stores/layout.svelte.js";
import { workspace } from "./stores/workspace.svelte.js";

/**
 * Opens a Google Sheet in Linework's own editor (for example from an event), adding it to
 * the person's spreadsheets.
 * @param {string} fileId
 */
export async function openSheetInLinework(fileId) {
  await workspace.addLink(fileId);
  if (mobileLayout.current) {
    mobileNav.intent = "edit";
    mobileNav.go("workspace");
    return;
  }
  desktopNav.go("scanner");
  await tick();
  document.getElementById("sheets-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
