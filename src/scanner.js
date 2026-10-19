import {
  CameraEnhancer,
  CameraView,
  CaptureVisionRouter,
  CoreModule,
  EnumCapturedResultItemType,
  LicenseManager,
  MultiFrameResultCrossFilter,
} from "../vendor/dynamsoft/dist/dbr.bundle.mjs";
import { NativeScanner } from "./native-scanner.js";

// The runtime files stay beside the exact SDK build supplied with this project.
CoreModule.engineResourcePaths.dbrBundle = new URL("../vendor/dynamsoft/dist/", import.meta.url).href;

// Dynamsoft's public evaluation key is valid for 24 hours per new browser.
export const PUBLIC_TEST_LICENSE = "DLS2eyJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSJ9";
const license = localStorage.getItem("linework-license") || PUBLIC_TEST_LICENSE;
const licenseReady = Promise.resolve().then(() => LicenseManager.initLicense(license));
// Surface authorization errors through camera/image actions instead of an unhandled promise.
licenseReady.catch(() => {});

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
    this.native = new NativeScanner({ cameraContainer, onResults });
    this.engine = "dynamsoft";
    this.fallback = false;
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
    if (this.fallback) return this.startNative();
    try {
      await licenseReady;
      await this.initializeCamera();
      await this.camera.open();
      this.view.setScanLaserVisible(false);
      await this.router.startCapturing("ReadBarcodes_SpeedFirst");
      this.active = true;
      this.engine = "dynamsoft";
      return this.camera.getAllCameras();
    } catch (error) {
      if (!NativeScanner.supported || /NotAllowedError|Permission denied/i.test(String(error))) throw error;
      console.warn("Dynamsoft scanner unavailable; using browser scanner", error);
      this.router?.dispose();
      this.camera?.dispose();
      this.router = null;
      this.camera = null;
      this.fallback = true;
      return this.startNative();
    }
  }

  async startNative() {
    const cameras = await this.native.start();
    this.active = true;
    this.engine = "browser";
    return cameras;
  }

  async stop() {
    this.active = false;
    if (this.engine === "browser") return this.native.stop();
    this.router?.stopCapturing();
    if (this.camera?.isOpen()) await this.camera.close();
  }

  async selectCamera(deviceId) {
    if (this.engine === "browser") return this.native.selectCamera(deviceId);
    await this.camera.selectCamera(deviceId);
  }

  get selectedCamera() { return this.engine === "browser" ? null : this.camera?.getSelectedCamera(); }
  get torchSupported() { return this.engine === "browser" ? this.native.torchSupported : Boolean(this.camera?.isSupportTorch); }
  get torchOn() { return this.engine === "browser" ? this.native.torchOn : Boolean(this.camera?.isTorchOn); }

  async toggleTorch() {
    if (this.engine === "browser") return this.native.toggleTorch();
    if (!this.torchSupported) return false;
    if (this.torchOn) await this.camera.turnOffTorch();
    else await this.camera.turnOnTorch();
    return this.torchOn;
  }

  async scanImage(file) {
    try {
      await licenseReady;
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
    } catch (error) {
      if (!NativeScanner.supported) throw error;
      console.warn("Dynamsoft image decode unavailable; using browser scanner", error);
      this.fallback = true;
      return this.native.scanImage(file);
    }
  }

  dispose() {
    this.active = false;
    this.router?.dispose();
    this.camera?.dispose();
    this.native.dispose();
  }
}
