// Browser-native fallback for environments where the Dynamsoft evaluation key has expired.
// BarcodeDetector is not available in every browser and may support fewer formats.
export class NativeScanner {
  static get supported() { return "BarcodeDetector" in window; }

  constructor({ cameraContainer, onResults }) {
    this.cameraContainer = cameraContainer;
    this.onResults = onResults;
    this.detector = null;
    this.video = null;
    this.stream = null;
    this.active = false;
    this.lastDetection = 0;
    this.frame = 0;
  }

  async getDetector() {
    if (!NativeScanner.supported) throw new Error("This browser does not support its built-in barcode scanner. Enter a Dynamsoft license in Settings.");
    if (!this.detector) this.detector = new BarcodeDetector();
    return this.detector;
  }

  normalize(results, source) {
    return results.map((result) => ({
      id: crypto.randomUUID(),
      text: result.rawValue || "",
      format: (result.format || "Unknown format").replaceAll("_", " ").toUpperCase(),
      bytes: new TextEncoder().encode(result.rawValue || "").length,
      confidence: null,
      angle: null,
      source,
      time: new Date(),
    }));
  }

  async start(deviceId) {
    await this.getDetector();
    const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }, audio: false };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.srcObject = this.stream;
    this.video.style.cssText = "width:100%;height:100%;object-fit:cover";
    this.cameraContainer.replaceChildren(this.video);
    try {
      await this.video.play();
      this.active = true;
      this.detectLoop();
      return (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({ deviceId: device.deviceId, label: device.label }));
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async detectLoop() {
    if (!this.active) return;
    const now = performance.now();
    if (this.video?.readyState >= 2 && now - this.lastDetection > 180) {
      this.lastDetection = now;
      try {
        const results = await this.detector.detect(this.video);
        if (this.active && results.length) this.onResults(this.normalize(results, "Camera · browser"));
      } catch (error) {
        console.warn("Browser barcode detection skipped a frame", error);
      }
    }
    if (this.active) this.frame = requestAnimationFrame(() => this.detectLoop());
  }

  async stop() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.video) this.video.srcObject = null;
    this.stream = null;
  }

  async selectCamera(deviceId) {
    await this.stop();
    return this.start(deviceId);
  }

  get track() { return this.stream?.getVideoTracks()[0]; }
  get torchSupported() { return Boolean(this.track?.getCapabilities?.().torch); }
  get torchOn() { return Boolean(this.track?.getSettings?.().torch); }

  async toggleTorch() {
    if (!this.torchSupported) return false;
    await this.track.applyConstraints({ advanced: [{ torch: !this.torchOn }] });
    return this.torchOn;
  }

  async scanImage(file) {
    const detector = await this.getDetector();
    const bitmap = await createImageBitmap(file);
    try { return this.normalize(await detector.detect(bitmap), file.name + " · browser"); }
    finally { bitmap.close(); }
  }

  dispose() { this.stop(); }
}
