import { BarcodeScanner, SAMPLE_LICENSE } from "./scanner.js";
import { interpret } from "./interpret.js";

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
    elements.captureHint.textContent = "Hold a barcode inside the frame. Results appear automatically.";
    elements.cameraSelect.replaceChildren(...cameras.map((camera) => {
      const option = el("option", "", camera.label || "Camera");
      option.value = camera.deviceId;
      return option;
    }));
    elements.cameraSelect.hidden = cameras.length < 2;
    const selected = scanner.camera.getSelectedCamera();
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
    const duplicate = scans.find((scan) => scan.source === "Camera" && item.source === "Camera" && scan.format === item.format && scan.text === item.text && now - scan.time.getTime() < 6000);
    if (duplicate) continue;
    scans.unshift(item);
    selectedId = item.id;
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
    detailRow("Content", interpreted.kind),
    detailRow("Format", scan.format),
    detailRow("Size", `${scan.bytes} ${scan.bytes === 1 ? "byte" : "bytes"}`),
    detailRow("Source", scan.source),
    detailRow("Scanned", formatTime(scan.time)),
    ...interpreted.fields.map(([label, value]) => detailRow(label, value)),
  );
  if (scan.confidence !== null) table.append(detailRow("Confidence", `${Math.round(scan.confidence)}%`));
  if (scan.angle !== null) table.append(detailRow("Rotation", `${Math.round(scan.angle)}°`));
  result.append(top, format, payloadBlock, actions, el("h3", "details-heading", "Code details"), table);
  elements.resultArea.replaceChildren(result);

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
    if (results.length) addResults(results);
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
$("#settings-button").addEventListener("click", () => {
  elements.licenseInput.value = localStorage.getItem("linework-license") || SAMPLE_LICENSE;
  elements.settingsDialog.showModal();
});
$("#save-license").addEventListener("click", () => {
  const key = elements.licenseInput.value.trim();
  if (!key) { showToast("Enter a license key first"); return; }
  localStorage.setItem("linework-license", key);
  location.reload();
});
window.addEventListener("pagehide", () => scanner.dispose());

setCameraUI();
