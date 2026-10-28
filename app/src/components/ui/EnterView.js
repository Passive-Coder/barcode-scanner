import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "../../lib/motion.js";

/** Fade and lift content when a screen or result appears, like the website's enter() effect.
 * @param {{ children: import("react").ReactNode, delay?: number, duration?: number, y?: number, x?: number, style?: import("react-native").StyleProp<import("react-native").ViewStyle> }} props
 */
export function EnterView({ children, delay = 0, duration = 420, y = 12, x = 0, style }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress, reduced]);

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
