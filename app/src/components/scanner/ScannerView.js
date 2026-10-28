import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { ReadConfirmer } from "../../lib/barcode/confirm.js";
import { BARCODE_TYPES, formatLabel } from "../../lib/barcode/formats.js";
import { attempt } from "../../lib/feedback.js";
import { byteLength } from "../../lib/format.js";
import { CONTENT_WIDTH, FILL, colors, contentInset, radius } from "../../lib/theme.js";
import { useAppActive } from "../../lib/use-app-active.js";
import { uuid } from "../../lib/uuid.js";
import { session } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Text } from "../ui/Text.js";

/** The camera reports the same code many times a second; ignore repeats this close together. */
const SAME_CODE_MS = 1500;
/** The camera never takes more than this much of a tall or wide screen. */
const FRAME_MAX_HEIGHT = 520;
/**
 * Zoom steps, as a share of the camera's own maximum zoom (which varies by phone): zooming in
 * helps with small or distant codes, which the camera can't focus on up close.
 */
const ZOOM_LEVELS = [0, 0.12, 0.3];
const ZOOM_LABELS = ["Zoom in", "Zoom in more", "Zoom out"];

/**
 * The camera, scanning every barcode type continuously, plus scanning from a photo. The camera
 * runs only while this screen is showing and the app is in the foreground.
 */
export function ScannerView() {
  const [permission, requestPermission] = useCameraPermissions();
  const { width } = useWindowDimensions();
  const [torch, setTorch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const focused = useIsFocused();
  const appActive = useAppActive();
  const last = useRef({ text: "", at: 0 });
  const confirmer = useRef(new ReadConfirmer());

  /** @param {import("expo-camera").BarcodeScanningResult} result */
  function onScanned(result) {
    const now = Date.now();
    if (!result.data) return;
    const format = formatLabel(result.type);
    // Codes without a check digit count only once two frames agree (see ReadConfirmer).
    if (!confirmer.current.accept({ text: result.data, format }, now)) return;
    if (result.data === last.current.text && now - last.current.at < SAME_CODE_MS) return;
    last.current = { text: result.data, at: now };
    session.add([{ id: uuid(), text: result.data, format, bytes: byteLength(result.data), origin: "camera", source: "Camera", time: new Date() }]);
  }

  async function scanPhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    const results = await scanFromURLAsync(picked.assets[0].uri, BARCODE_TYPES);
    if (!results.length) {
      toast.show(Platform.OS === "ios" ? "No QR code found in that photo. (On iPhone, photos can be scanned for QR codes only.)" : "No barcode found in that photo.");
      return;
    }
    const source = picked.assets[0].fileName ?? "Photo";
    session.add(results.map((result) => ({ id: uuid(), text: result.data, format: formatLabel(result.type), bytes: byteLength(result.data), origin: /** @type {const} */ ("image"), source, time: new Date() })));
  }

  // As wide as the content, 3:4 on phones, and no taller than FRAME_MAX_HEIGHT on tablets.
  const frame = [styles.frame, { height: Math.min(FRAME_MAX_HEIGHT, (Math.min(width - contentInset(width) * 2, CONTENT_WIDTH) * 4) / 3) }];

  if (!permission) return <View style={frame} />;

  if (!permission.granted) {
    return (
      <View style={[frame, styles.message]}>
        <Text variant="subheading" color={colors.pageInk}>
          Camera access is needed to scan
        </Text>
        <Text color={colors.pageMuted} style={styles.center}>
          {permission.canAskAgain ? "Linework uses the camera only while this screen is open." : "Camera access is turned off for Linework. Turn it on in your phone's Settings."}
        </Text>
        {permission.canAskAgain ? (
          <Button variant="primary" label="Allow camera" onPress={() => requestPermission()} />
        ) : (
          <Button variant="primary" label="Open Settings" onPress={() => Linking.openSettings()} />
        )}
        <Button label="Scan a photo instead" onPress={() => attempt(scanPhoto, "Could not scan the photo")} />
      </View>
    );
  }

  const live = focused && appActive && !paused;
  return (
    <View style={styles.wrap}>
      <View style={frame}>
        {focused ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            active={live}
            enableTorch={torch && live}
            zoom={ZOOM_LEVELS[zoomStep]}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={live ? onScanned : undefined}
          />
        ) : null}
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.window} />
          <Text variant="small" weight="semibold" color={colors.pageInk} style={styles.hint}>
            {live ? "Point the camera at a barcode" : "Scanning paused"}
          </Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Button compact label={paused ? "Resume" : "Pause"} onPress={() => setPaused((value) => !value)} />
        {Platform.OS !== "web" ? <Button compact label={torch ? "Light off" : "Light on"} onPress={() => setTorch((value) => !value)} /> : null}
        <Button compact label={ZOOM_LABELS[zoomStep]} onPress={() => setZoomStep((step) => (step + 1) % ZOOM_LEVELS.length)} />
        <Button compact label="Scan a photo" onPress={() => attempt(scanPhoto, "Could not scan the photo")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  frame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.medium,
    backgroundColor: "#2a060e",
  },
  message: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 20,
  },
  center: {
    textAlign: "center",
  },
  overlay: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  window: {
    width: "72%",
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: "rgba(255, 245, 232, 0.85)",
    borderRadius: radius.medium,
  },
  hint: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(42, 6, 14, 0.7)",
    overflow: "hidden",
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
