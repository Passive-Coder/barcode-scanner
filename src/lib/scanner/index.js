import { session } from "../stores/session.svelte.js";
import { CameraScanner } from "./camera-scanner.js";

/** The app's single camera scanner; decoded scans go straight into the session. */
export const cameraScanner = new CameraScanner({ onResults: (scans) => session.add(scans) });

export { scanImageFile } from "./image-scanner.js";
