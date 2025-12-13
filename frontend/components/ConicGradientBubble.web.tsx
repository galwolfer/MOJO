import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { COLORS, SPACING } from "../theme";

type Props = {
  style?: ViewStyle;
};

const gradientStops = [
  `${COLORS.primary1} 0deg`,
  `${COLORS.primary2} 45deg`,
  `${COLORS.primary1} 90deg`,
  `${COLORS.primary2} 135deg`,
  `${COLORS.primary1} 180deg`,
  `${COLORS.primary2} 225deg`,
  `${COLORS.primary1} 270deg`,
  `${COLORS.primary2} 315deg`,
  `${COLORS.primary1} 360deg`,
].join(", ");

const shadowShrink = SPACING.xlg;

export default function ConicGradientBubble({ style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, [progress]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.mask}>
        <Animated.View style={[styles.gradient, spinStyle]} />
      </View>
    </View>
  );
}

type WebGradientStyle = ViewStyle & {
  backgroundImage: string;
};

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    position: "absolute",
    top: shadowShrink / 2,
    left: shadowShrink / 2,
    right: shadowShrink / 2,
    bottom: shadowShrink / 2,
    overflow: "hidden",
  },
  gradient: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "150vmax",
    height: "150vmax",
    marginLeft: "-75vmax",
    marginTop: "-75vmax",
    backgroundImage: `conic-gradient(${gradientStops})`,
  } as unknown as WebGradientStyle,
});
