import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { MOBILE_QUERY } from "./lib/config.js";

// Pick the theme before the first paint so the page never flashes the wrong palette.
document.documentElement.dataset.layout = matchMedia(MOBILE_QUERY).matches ? "mobile" : "desktop";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app mount point in index.html");

export default mount(App, { target });
