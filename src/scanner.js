import {
  CameraEnhancer,
  CameraView,
  CaptureVisionRouter,
  CoreModule,
  EnumCapturedResultItemType,
  LicenseManager,
  MultiFrameResultCrossFilter,
} from "../vendor/dynamsoft/dist/dbr.bundle.mjs";

// The runtime files stay beside the exact SDK build supplied with this project.
CoreModule.engineResourcePaths.dbrBundle = new URL("../vendor/dynamsoft/dist/", import.meta.url).href;

// Sample key from the supplied SDK's own examples. Replace in Settings if it expires.
export const SAMPLE_LICENSE = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA2NDc4ODM4LU1UQTJORGM0T0RNNExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDY0Nzg4MzgiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjotMjQ1NTYxODg3fQ==";

LicenseManager.initLicense(localStorage.getItem("linework-license") || SAMPLE_LICENSE);

function normalize(item, source) {
  return {
    id: crypto.randomUUID(),
    text: item.text || "",
    format: item.formatString || "Unknown format",
    bytes: item.bytes?.length ?? new TextEncoder().encode(item.text || "").length,
    confidence: Number.isFinite(item.confidence) ? item.confidence : null,
    angle: Number.isFinite(item.angle) ? item.angle : null,
    source,
    time: new Date(),
  };
}

export class BarcodeScanner {
  constructor({ cameraContainer, onResults }) {
    this.cameraContainer = cameraContainer;
    this.onResults = onResults;
    this.router = null;
    this.camera = null;
    this.view = null;
    this.active = false;
    this.initializing = null;
  }

  async initializeCamera() {
    if (this.router && this.camera) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      let view;
      let camera;
      let router;
      try {
        view = await CameraView.createInstance();
        camera = await CameraEnhancer.createInstance(view);
        router = await CaptureVisionRouter.createInstance();
        router.setInput(camera);
        await router.addResultReceiver({
          onDecodedBarcodesReceived: (result) => {
            if (!this.active || !result.barcodeResultItems?.length) return;
            this.onResults(result.barcodeResultItems.map((item) => normalize(item, "Camera")));
          },
        });
        const filter = new MultiFrameResultCrossFilter();
        filter.enableResultCrossVerification("barcode", true);
        filter.enableResultDeduplication("barcode", true);
        await router.addResultFilter(filter);
        this.cameraContainer.replaceChildren(camera.getUIElement());
        this.view = view;
        this.camera = camera;
        this.router = router;
      } catch (error) {
        router?.dispose();
        camera?.dispose();
        throw error;
      }
    })();
    try { await this.initializing; } finally { this.initializing = null; }
  }

  async start() {
    await this.initializeCamera();
    await this.camera.open();
    this.view.setScanLaserVisible(false);
    await this.router.startCapturing("ReadBarcodes_SpeedFirst");
    this.active = true;
    return this.camera.getAllCameras();
  }

  async stop() {
    this.active = false;
    this.router?.stopCapturing();
    if (this.camera?.isOpen()) await this.camera.close();
  }

  async selectCamera(deviceId) {
    await this.camera.selectCamera(deviceId);
  }

  get torchSupported() { return Boolean(this.camera?.isSupportTorch); }
  get torchOn() { return Boolean(this.camera?.isTorchOn); }

  async toggleTorch() {
    if (!this.torchSupported) return false;
    if (this.torchOn) await this.camera.turnOffTorch();
    else await this.camera.turnOnTorch();
    return this.torchOn;
  }

  async scanImage(file) {
    // A separate router keeps image decoding independent of the live camera.
    const router = await CaptureVisionRouter.createInstance();
    try {
      const result = await router.capture(file, "ReadBarcodes_ReadRateFirst");
      return result.items
        .filter((item) => item.type === EnumCapturedResultItemType.CRIT_BARCODE)
        .map((item) => normalize(item, file.name));
    } finally {
      router.dispose();
    }
  }

  dispose() {
    this.active = false;
    this.router?.dispose();
    this.camera?.dispose();
  }
}
