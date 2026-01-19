import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { COLORS, SPACING } from "../../theme";

type Props = {
  style?: ViewStyle;
  colors?: string[];
};

// default gradient (will be overridden by props)
function gradientStopsFromColors(colors: string[]) {
  const n = colors.length;
  if (n === 0) return `${COLORS.primary1} 0deg`;
  const step = 360 / n;
  return colors
    .map((c, i) => `${c} ${Math.round(i * step)}deg`)
    .concat(`${colors[0]} 360deg`)
    .join(", ");
}

const shadowShrink = SPACING.lg;

/**
 * ConicGradientBubble - A web-specific animated gradient bubble component using Reanimated.
 * @param style - Optional custom styles.
 */
export default function ConicGradientBubble({
  style,
  colors = [COLORS.primary1, COLORS.primary2, COLORS.primary1],
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, [progress]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  const gradientStops = gradientStopsFromColors(colors);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.mask}>
        <Animated.View style={[styles.gradient, spinStyle, { backgroundImage: `conic-gradient(${gradientStops})` }]} />
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
    borderRadius: SPACING.xlg,
  },
  gradient: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "150vmax",
    height: "150vmax",
    marginLeft: "-75vmax",
    marginTop: "-75vmax",
    borderRadius: SPACING.xlg,
  } as unknown as WebGradientStyle,
});
