import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Match the website's prefers-reduced-motion behavior on iOS and Android. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
