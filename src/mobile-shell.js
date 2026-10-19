import { councilMark } from "./council-mark.js";

const $ = (selector) => document.querySelector(selector);
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function element(tag, className, text) {
  const item = document.createElement(tag);
  item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function displayName(email) {
  const local = email?.split("@")[0] || "there";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class MobileShell {
  constructor({ sheets, scanner, toast, onOpenAdvanced, onStopCamera }) {
    this.sheets = sheets;
    this.scanner = scanner;
    this.toast = toast;
    this.onOpenAdvanced = onOpenAdvanced;
    this.onStopCamera = onStopCamera;
    this.intent = "scan";
    this.busy = false;
    $("#mobile-header-logo").innerHTML = councilMark;
    $("#mobile-loader-logo").innerHTML = councilMark;
    $("#mobile-settings-mark").innerHTML = councilMark;
    this.bind();
    this.route("welcome", false);
    this.animateRibbons();
  }

  route(view, animate = true) {
    document.body.dataset.mobileView = view;
    this.view = view;
    if (view !== "scan" && this.scanner.active) this.onStopCamera();
    if (view === "choose") this.renderSheets();
    if (view === "home") this.updateGreeting();
    if (view === "scan" || view === "edit") {
      $("#mobile-work-title").textContent = view === "scan" ? "Barcode scanning" : "Edit Google Sheets";
      $("#mobile-work-context").textContent = this.sheets.metadata?.properties?.title || "Google Sheets";
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    if (animate && window.gsap && !reduceMotion()) {
      const target = view === "choose" ? ".mobile-choose-inner" : view === "home" ? ".mobile-home-inner" : view === "scan" || view === "edit" ? ".mobile-workbar" : null;
      if (target) window.gsap.fromTo(target, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .52, ease: "power3.out" });
    }
  }

  updateGreeting() {
    $("#mobile-greeting").textContent = `Hi ${displayName(this.sheets.auth.email)}`;
  }

  animateRibbons() {
    if (!window.gsap || reduceMotion()) return;
    window.gsap.to(".mobile-ribbons-top img", { xPercent: 5, rotation: 1.5, duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true });
    window.gsap.to(".mobile-ribbons-bottom img", { xPercent: -5, rotation: -1.5, duration: 8, ease: "sine.inOut", repeat: -1, yoyo: true });
  }

  async signIn() {
    if (this.busy) return;
    this.busy = true;
    const button = $("#mobile-signin");
    button.disabled = true;
    button.querySelector(".mobile-signin-label").textContent = "Connecting…";
    try {
      await this.sheets.connect();
      await this.reveal();
    } catch (error) {
      this.toast(error?.message || "Google sign-in failed");
      if (this.sheets.auth.connected) await this.reveal();
    } finally {
      this.busy = false;
      button.disabled = false;
      button.querySelector(".mobile-signin-label").textContent = "Continue with Google";
    }
  }

  async reveal() {
    this.route("reveal", false);
    this.updateGreeting();
    const loader = $("#mobile-reveal");
    const logo = $("#mobile-loader-logo");
    if (!window.gsap || reduceMotion()) { this.route("home", false); return; }
    const gsap = window.gsap;
    const figures = logo.querySelectorAll(".council-figure");
    gsap.set(figures, { opacity: 0, scale: .45, transformOrigin: "50% 50%" });
    gsap.set(logo, { x: 0, y: 0, scale: 1, rotation: 0, transformOrigin: "50% 50%" });
    gsap.set(loader, { opacity: 1 });
    await new Promise((resolve) => {
      const timeline = gsap.timeline({ onComplete: resolve });
      timeline.to(figures[0], { opacity: 1, scale: 1, duration: .48, ease: "back.out(1.7)" })
        .to(Array.from(figures).slice(1), { opacity: 1, scale: 1, duration: .44, stagger: .16, ease: "back.out(1.5)" }, ">-.05")
        .fromTo(logo.querySelector(".council-people"), { rotation: -74, transformOrigin: "50% 50%" }, { rotation: 0, duration: 1.15, ease: "power3.out" }, "<")
        .to(logo, { rotation: 360, duration: 1.05, ease: "power3.inOut" }, ">+.12")
        .add(() => {
          document.body.dataset.mobileView = "reveal-home";
          this.updateGreeting();
        })
        .to(loader, { backgroundColor: "rgba(84, 7, 23, 0)", duration: .45 }, "<")
        .add(() => {
          const from = logo.getBoundingClientRect();
          const to = $("#mobile-header-logo").getBoundingClientRect();
          gsap.to(logo, { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2), scale: to.width / from.width, duration: .85, ease: "power3.inOut" });
        }, ">")
        .to(loader, { opacity: 0, duration: .3 }, ">+.78");
    });
    this.route("home", false);
    gsap.set(loader, { clearProps: "all" });
  }

  renderSheets() {
    $("#mobile-choose-title").textContent = this.intent === "scan" ? "Choose a sheet to scan into." : "Choose a sheet to edit.";
    $("#mobile-choose-kicker").textContent = this.intent === "scan" ? "01 / BARCODE SCANNING" : "02 / GOOGLE SHEETS";
    const list = $("#mobile-sheet-list");
    list.replaceChildren();
    for (const [index, link] of this.sheets.links.entries()) {
      const button = element("button", "mobile-sheet-item");
      button.type = "button";
      const number = element("span", "mobile-sheet-number", String(index + 1).padStart(2, "0"));
      const title = element("span", "mobile-sheet-name", link.title);
      const icon = element("span", "mobile-sheet-arrow", "↗");
      button.append(number, title, icon);
      button.addEventListener("click", () => this.selectSheet(link.id));
      list.append(button);
    }
    $("#mobile-sheet-empty").hidden = this.sheets.links.length > 0;
    $("#mobile-sheet-list-label").hidden = this.sheets.links.length === 0;
  }

  async selectSheet(id) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.sheets.loadDocument(id);
      this.route(this.intent);
    } catch (error) { this.toast(error?.message || "Could not open spreadsheet"); }
    finally { this.busy = false; }
  }

  async addSheet(event) {
    event.preventDefault();
    if (this.busy) return;
    const input = $("#mobile-sheet-url");
    this.busy = true;
    const submit = $("#mobile-add-sheet");
    submit.disabled = true;
    try {
      await this.sheets.addLink(input.value);
      input.value = "";
      this.renderSheets();
      this.route(this.intent);
    } catch (error) { this.toast(error?.message || "Could not connect spreadsheet"); }
    finally { this.busy = false; submit.disabled = false; }
  }

  bind() {
    $("#mobile-signin").addEventListener("click", () => this.signIn());
    for (const [id, intent] of [["#mobile-scan-choice", "scan"], ["#mobile-edit-choice", "edit"]]) {
      $(id).addEventListener("click", () => { this.intent = intent; this.route("choose"); });
    }
    $("#mobile-choose-back").addEventListener("click", () => this.route("home"));
    $("#mobile-work-back").addEventListener("click", () => this.route("choose"));
    $("#mobile-switch-sheet").addEventListener("click", () => this.route("choose"));
    $("#mobile-sheet-form").addEventListener("submit", (event) => this.addSheet(event));
    $("#mobile-header-logo").addEventListener("click", () => $("#mobile-settings-dialog").showModal());
    $("#mobile-advanced-settings").addEventListener("click", () => {
      $("#mobile-settings-dialog").close();
      this.onOpenAdvanced();
    });
    $("#mobile-signout").addEventListener("click", () => {
      $("#mobile-settings-dialog").close();
      this.sheets.disconnect();
      this.route("welcome");
    });
  }
}
