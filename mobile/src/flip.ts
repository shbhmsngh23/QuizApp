import { Animated } from "react-native";

export function createFlipAnimation() {
  const animatedValue = new Animated.Value(0);

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"]
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"]
  });

  const flipToFront = () =>
    Animated.spring(animatedValue, {
      toValue: 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true
    }).start();

  const flipToBack = () =>
    Animated.spring(animatedValue, {
      toValue: 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true
    }).start();

  return {
    animatedValue,
    frontInterpolate,
    backInterpolate,
    flipToFront,
    flipToBack
  };
}
