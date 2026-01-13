import React, { useState, useEffect } from "react";
import { View, ViewStyle, LayoutChangeEvent, StyleSheet } from "react-native";
import { Canvas, Rect, SweepGradient, vec } from "@shopify/react-native-skia";
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { COLORS, SPACING } from "../../theme";

type Props = {
  style?: ViewStyle;
  colors?: string[]; // gradient colors
};

/**
 * ConicGradientBubble - An animated gradient bubble component using Skia.
 * @param style - Optional custom styles.
 */
export default function ConicGradientBubble({
  style,
  colors = [COLORS.primary1, COLORS.primary2, COLORS.primary1],
}: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const center = useSharedValue(vec(0, 0));

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    center.value = vec(width / 2, height / 2);
  }

  const shadowShrink = SPACING.xlg * 1.5;
  const progress = useSharedValue(0);

  // colors for the sweep gradient - use passed-in `colors` prop
  const gradientColors: string[] =
    Array.isArray(colors) && colors.length > 0 ? colors : [COLORS.primary1, COLORS.primary2, COLORS.primary1];

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, []);

  const centerPoint = size ? vec(size.w / 2, size.h / 2) : vec(0, 0);

  const transform = useDerivedValue(() => {
    return [
      { translateX: center.value.x },
      { translateY: center.value.y },
      { rotate: progress.value * 2 * Math.PI },
      { translateX: -center.value.x },
      { translateY: -center.value.y },
    ];
  });

  return (
    <View onLayout={onLayout} style={[styles.wrapper, style]}>
      {size && (
        <Canvas style={{ flex: 1 }}>
          <Rect x={shadowShrink / 2} y={shadowShrink / 2} width={size.w - shadowShrink} height={size.h - shadowShrink}>
            <SweepGradient
              c={centerPoint}
              colors={gradientColors}
              start={0}
              positions={gradientColors.map((_: string, i: number) => i / Math.max(1, gradientColors.length - 1))}
              transform={transform}
            />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
  },
});
