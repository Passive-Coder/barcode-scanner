import { MediaQuery } from "svelte/reactivity";
import { MOBILE_QUERY } from "../config.js";
import { auth } from "./auth.svelte.js";

/** True below the mobile breakpoint, where the guided mobile flow replaces the desktop studio. */
export const mobileLayout = new MediaQuery(MOBILE_QUERY);

/**
 * @typedef {"welcome" | "home" | "choose" | "workspace"} MobileView
 * @typedef {"scan" | "edit"} MobileIntent
 */

/** Navigation for the mobile flow: welcome → home → choose a sheet → scan or edit. */
class MobileNavigation {
  /** @type {MobileView} */
  view = $state("welcome");
  /** @type {MobileIntent} */
  intent = $state("scan");
  /** True while the sign-in animation plays over the home screen. */
  revealing = $state(false);

  /** @param {MobileView} view */
  go(view) {
    // Only a signed-out visitor is sent back to the start; an expired session keeps its place
    // and shows a reconnect banner instead.
    this.view = view !== "welcome" && auth.status === "signed-out" ? "welcome" : view;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /** @param {MobileIntent} intent */
  choose(intent) {
    this.intent = intent;
    this.go("choose");
  }
}

export const mobileNav = new MobileNavigation();
