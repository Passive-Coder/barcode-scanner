import { RecordingBar } from "../../components/scanner/RecordingBar.js";
import { ScanHistory, ScanResult } from "../../components/scanner/ScanResult.js";
import { ScannerView } from "../../components/scanner/ScannerView.js";
import { PendingChanges } from "../../components/sheets/PendingChanges.js";
import { Screen } from "../../components/ui/Screen.js";
import { useStore } from "../../lib/store.js";
import { workspace } from "../../stores/workspace.js";

/**
 * The scanner: the camera, whether scans are being recorded, and the latest scan. Where scans go
 * lives on the Sheet settings screen. Leaving this screen turns the camera off.
 */
export default function Scan() {
  useStore(workspace);
  return (
    <Screen title={workspace.title || "Scanner"} subtitle="Scanning">
      <ScannerView />
      <RecordingBar />
      <PendingChanges />
      <ScanResult />
      <ScanHistory />
    </Screen>
  );
}
