import { BarcodeScanner, PUBLIC_TEST_LICENSE } from "./scanner.js";
import { interpret } from "./interpret.js";
import { extractScanFields } from "./barcode-fields.js";
import { SheetsWorkspace } from "./sheets-workspace.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  cameraTab: $("#camera-tab"), imageTab: $("#image-tab"),
  cameraPanel: $("#camera-panel"), imagePanel: $("#image-panel"),
  cameraFrame: $("#camera-frame"), cameraEmpty: $("#camera-empty"),
  cameraSelect: $("#camera-select"), liveBadge: $("#live-badge"),
  startButton: $("#start-button"), startLabel: $("#start-label"),
  torchButton: $("#torch-button"), captureHint: $("#capture-hint"),
  imageInput: $("#image-input"), dropZone: $("#drop-zone"),
  resultArea: $("#result-area"), historyList: $("#history-list"),
  clearButton: $("#clear-button"), toast: $("#toast"),
  settingsDialog: $("#settings-dialog"), licenseInput: $("#license-input"),
};

const scans = [];
let selectedId = null;
let cameraBusy = false;
let scanBusy = false;
let toastTimer;
const scanner = new BarcodeScanner({
  cameraContainer: $("#camera-view"),
  onResults: addResults,
});
const sheets = new SheetsWorkspace({
  onToast: showToast,
  onError: (error, context) => { console.error(context, error); showToast(error.message || String(error)); },
  onMappingChange: renderResults,
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3600);
}

function reportError(error, context) {
  console.error(context, error);
  const raw = String(error?.message || error || "Unknown error");
  let message = raw;
  if (/NotAllowedError|Permission denied|permission/i.test(raw)) message = "Camera access was denied. Allow it in your browser settings and try again.";
  else if (/NotFoundError|Requested device not found/i.test(raw)) message = "No camera was found. Try image upload instead.";
  else if (/license|trial|auth/i.test(raw)) message = "The Dynamsoft license could not be used. Add a valid key in Settings.";
  elements.captureHint.textContent = message;
  elements.captureHint.classList.add("error");
  showToast(message);
}

function setMode(mode) {
  const camera = mode === "camera";
  elements.cameraPanel.hidden = !camera;
  elements.imagePanel.hidden = camera;
  elements.cameraTab.classList.toggle("active", camera);
  elements.imageTab.classList.toggle("active", !camera);
  elements.cameraTab.setAttribute("aria-selected", String(camera));
  elements.imageTab.setAttribute("aria-selected", String(!camera));
  if (!camera && scanner.active) stopCamera();
}

function openSettings() {
  elements.licenseInput.value = localStorage.getItem("linework-license") || PUBLIC_TEST_LICENSE;
  $("#client-id-input").value = sheets.auth.clientId;
  elements.settingsDialog.showModal();
}

function setCameraUI() {
  const live = scanner.active;
  elements.cameraFrame.classList.toggle("is-live", live);
  elements.cameraEmpty.hidden = live;
  elements.liveBadge.hidden = !live;
  elements.startLabel.textContent = live ? "Stop camera" : "Start camera";
  elements.startButton.classList.toggle("stop-button", live);
  elements.torchButton.disabled = !live || !scanner.torchSupported;
  elements.torchButton.title = scanner.torchSupported ? "Toggle flashlight" : "Torch unavailable on this camera";
  elements.torchButton.textContent = scanner.torchOn ? "Flash on" : "Flash off";
}

async function startCamera() {
  if (cameraBusy) return;
  cameraBusy = true;
  elements.startButton.disabled = true;
  elements.startLabel.textContent = "Starting…";
  elements.captureHint.classList.remove("error");
  elements.captureHint.textContent = "Preparing the camera and barcode engine…";
  try {
    if (!window.isSecureContext) throw new Error("Camera access needs localhost or HTTPS.");
    const cameras = await scanner.start();
    if (elements.cameraPanel.hidden) {
      await scanner.stop();
      return;
    }
    elements.captureHint.textContent = scanner.engine === "browser"
      ? "Using this browser’s barcode reader. Add a Dynamsoft key in Settings for full format support."
      : "Hold a barcode inside the frame. Results appear automatically.";
    elements.cameraSelect.replaceChildren(...cameras.map((camera) => {
      const option = el("option", "", camera.label || "Camera");
      option.value = camera.deviceId;
      return option;
    }));
    elements.cameraSelect.hidden = cameras.length < 2;
    const selected = scanner.selectedCamera;
    if (selected) elements.cameraSelect.value = selected.deviceId;
  } catch (error) {
    reportError(error, "Could not start camera");
    await scanner.stop().catch(() => {});
  } finally {
    cameraBusy = false;
    elements.startButton.disabled = false;
    setCameraUI();
  }
}

async function stopCamera() {
  if (cameraBusy) return;
  cameraBusy = true;
  elements.startButton.disabled = true;
  try {
    await scanner.stop();
    elements.captureHint.textContent = "Camera stopped. Start again whenever you’re ready.";
  } catch (error) {
    reportError(error, "Could not stop camera");
  } finally {
    cameraBusy = false;
    elements.startButton.disabled = false;
    setCameraUI();
  }
}

function addResults(items) {
  if (!items.length) return;
  const now = Date.now();
  let added = 0;
  for (const item of items) {
    const duplicate = scans.find((scan) => scan.source.startsWith("Camera") && item.source.startsWith("Camera") && scan.format === item.format && scan.text === item.text && now - scan.time.getTime() < 6000);
    if (duplicate) continue;
    scans.unshift(item);
    selectedId = item.id;
    const fields = extractScanFields(item);
    sheets.setFields(fields);
    sheets.recordScan(fields);
    added++;
  }
  if (scans.length > 50) scans.length = 50;
  if (!added) return;
  renderResults();
  showToast(`${added} barcode${added === 1 ? "" : "s"} captured`);
  if (navigator.vibrate) navigator.vibrate(60);
}

function detailRow(label, value) {
  const row = el("div", "detail-row");
  row.append(el("span", "detail-label", label), el("span", "detail-value", value));
  return row;
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function renderResults() {
  const scan = scans.find((item) => item.id === selectedId) || scans[0];
  elements.clearButton.disabled = scans.length === 0;
  if (!scan) {
    elements.resultArea.replaceChildren();
    const empty = el("div", "result-empty");
    const bars = el("div", "empty-bars");
    bars.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 9; i++) bars.append(el("span"));
    empty.append(bars, el("h3", "", "Nothing scanned yet"), el("p", "", "Scanned barcode details will appear here."));
    elements.resultArea.append(empty);
    elements.historyList.replaceChildren(el("p", "history-empty", "Your scans will be listed here for quick reference."));
    return;
  }

  const interpreted = interpret(scan.text, scan.format);
  const fields = extractScanFields(scan);
  const selected = sheets.selectedFields(fields);
  const mapped = Object.keys(sheets.mapping).length > 0;
  const shown = mapped ? selected : fields;
  const result = el("div", "result-content");
  const top = el("div", "result-top");
  top.append(el("span", "result-status", "●  DECODED SUCCESSFULLY"), el("span", "result-index", `${String(scans.length).padStart(2, "0")} IN SESSION`));
  const format = el("div", "format-line");
  format.append(el("span", "format-icon", "▥"), el("div", "format-name", scan.format));
  const payloadBlock = el("div", "payload-block");
  payloadBlock.append(el("div", "payload-label", "RAW VALUE"), el("div", "payload-value", scan.text || "(empty payload)"));
  const actions = el("div", "result-actions");
  const copy = el("button", "copy-button", "Copy value ↗");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(scan.text); showToast("Value copied to clipboard"); }
    catch { showToast("Clipboard is unavailable in this browser"); }
  });
  actions.append(copy);
  if (interpreted.link) {
    const link = el("a", "external-link", "Open link ↗");
    link.href = interpreted.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }
  const table = el("div", "details-table");
  table.append(
    detailRow("Content", fields.find((field) => field.key === "contentType")?.value || interpreted.kind),
    detailRow("Format", scan.format),
    detailRow("Size", `${scan.bytes} ${scan.bytes === 1 ? "byte" : "bytes"}`),
    detailRow("Source", scan.source),
    detailRow("Scanned", formatTime(scan.time)),
    ...interpreted.fields.map(([label, value]) => detailRow(label, value)),
  );
  if (scan.confidence !== null) table.append(detailRow("Confidence", `${Math.round(scan.confidence)}%`));
  if (scan.angle !== null) table.append(detailRow("Rotation", `${Math.round(scan.angle)}°`));
  const typedHeading = el("div", "typed-heading");
  typedHeading.append(el("h3", "", mapped ? "Selected fields" : "Detected fields"), el("span", "", mapped ? `${selected.length} matching this scan` : `${fields.length} fields found`));
  const typedList = el("div", "typed-list");
  if (!shown.length) typedList.append(el("p", "empty-note", "This barcode contains none of the mapped fields."));
  for (const field of shown) {
    const row = el("div", "typed-row");
    const name = el("div", "typed-name");
    name.append(el("strong", "", field.label), el("code", "", field.key));
    row.append(name, el("span", "type-pill", field.type), el("span", "typed-value", field.value || "—"));
    typedList.append(row);
  }
  const allButton = el("button", "text-button show-all-fields", "Show full scan");
  if (mapped) {
    allButton.type = "button";
    allButton.addEventListener("click", () => {
      typedList.replaceChildren(...fields.map((field) => {
        const row = el("div", "typed-row");
        const name = el("div", "typed-name");
        name.append(el("strong", "", field.label), el("code", "", field.key));
        row.append(name, el("span", "type-pill", field.type), el("span", "typed-value", field.value || "—"));
        return row;
      }));
      result.insertBefore(payloadBlock, typedHeading);
      result.insertBefore(actions, typedHeading);
      result.append(el("h3", "details-heading", "Code details"), table);
      allButton.remove();
    });
  }
  result.append(top, format);
  if (!mapped) result.append(payloadBlock, actions);
  result.append(typedHeading, typedList);
  if (mapped) result.append(allButton);
  else result.append(el("h3", "details-heading", "Code details"), table);
  elements.resultArea.replaceChildren(result);
  if (window.gsap && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.gsap.fromTo(result, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
    window.gsap.fromTo(typedList.children, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.035, ease: "power2.out" });
  }

  elements.historyList.replaceChildren(...scans.map((item, index) => {
    const button = el("button", `history-item${item.id === scan.id ? " selected" : ""}`);
    button.type = "button";
    button.append(el("span", "history-number", String(index + 1).padStart(2, "0")), el("span", "history-format", item.format), el("span", "history-value", item.text || "(empty)"), el("span", "history-time", formatTime(item.time)), el("span", "history-arrow", "↗"));
    button.addEventListener("click", () => { selectedId = item.id; renderResults(); });
    return button;
  }));
}

async function scanFile(file) {
  if (!file || scanBusy) return;
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
    showToast("Choose an image smaller than 20 MB");
    return;
  }
  scanBusy = true;
  elements.dropZone.classList.add("processing");
  elements.dropZone.querySelector("strong").textContent = "Reading image…";
  try {
    const results = await scanner.scanImage(file);
    if (results.length) {
      addResults(results);
      if (results[0].source.includes("browser")) elements.imagePanel.querySelector(".capture-hint").textContent = "Using this browser’s barcode reader. Add a Dynamsoft key in Settings for full format support.";
    }
    else showToast("No barcode found in this image. Try a clearer photo.");
  } catch (error) { reportError(error, "Could not read image"); }
  finally {
    scanBusy = false;
    elements.dropZone.classList.remove("processing");
    elements.dropZone.querySelector("strong").textContent = "Drop an image here";
    elements.imageInput.value = "";
  }
}

elements.cameraTab.addEventListener("click", () => setMode("camera"));
elements.imageTab.addEventListener("click", () => setMode("image"));
elements.startButton.addEventListener("click", () => scanner.active ? stopCamera() : startCamera());
elements.torchButton.addEventListener("click", async () => {
  try { await scanner.toggleTorch(); setCameraUI(); }
  catch (error) { reportError(error, "Could not toggle torch"); }
});
elements.cameraSelect.addEventListener("change", async (event) => {
  try { await scanner.selectCamera(event.target.value); setCameraUI(); }
  catch (error) { reportError(error, "Could not change camera"); }
});
elements.imageInput.addEventListener("change", (event) => scanFile(event.target.files?.[0]));
elements.dropZone.addEventListener("dragover", (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");
  scanFile(event.dataTransfer.files?.[0]);
});
elements.clearButton.addEventListener("click", () => { scans.length = 0; selectedId = null; renderResults(); showToast("Session history cleared"); });
$("#settings-button").addEventListener("click", openSettings);
$("#save-license").addEventListener("click", () => {
  const key = elements.licenseInput.value.trim();
  if (!key) { showToast("Enter a license key first"); return; }
  localStorage.setItem("linework-license", key);
  location.reload();
});
$("#save-client-id").addEventListener("click", () => {
  try {
    sheets.updateClientId($("#client-id-input").value);
    elements.settingsDialog.close();
    showToast("Google Client ID saved");
  } catch (error) { showToast(error.message); }
});
$("#disconnect-google").addEventListener("click", () => {
  sheets.disconnect();
  elements.settingsDialog.close();
  showToast("Google disconnected");
});
window.addEventListener("pagehide", () => scanner.dispose());

setCameraUI();
if (window.gsap && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.gsap.from(".page-heading > div:first-child > *", { opacity: 0, y: 20, duration: 0.75, stagger: 0.12, ease: "power3.out" });
  window.gsap.from(".main-grid > section", { opacity: 0, y: 24, duration: 0.8, stagger: 0.12, delay: 0.22, ease: "power3.out" });
  window.gsap.from(".hero-rule path", { strokeDasharray: 1600, strokeDashoffset: 1600, duration: 2, stagger: 0.14, ease: "power2.out" });
}
