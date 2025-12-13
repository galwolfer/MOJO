/**
 * ProgressIcon (native)
 *
 * Native version of `ProgressIcon` that uses `Animated` and
 * `react-native-svg` for performant mobile animations.
 */
import React, { useEffect, useRef } from "react";
import { Animated, View, Easing } from "react-native";
import Svg, { Path, Rect, Defs, ClipPath, G } from "react-native-svg";
import svgPaths from "../../assets/imports/svg-kilf0jp2lv";
import { COLORS } from "../../theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

interface ProgressIconProps {
  value: number; // 0 to 1
  size?: number;
}

/**
 * ProgressIcon - Animated progress indicator for native platforms.
 * @param value - Progress value between 0 and 1.
 * @param size - The size of the icon.
 */
export function ProgressIcon({ value, size = 18 }: ProgressIconProps) {
  const springValue = useRef(new Animated.Value(0)).current;
  const completionProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clampedValue = Math.max(0, Math.min(1, value));

    if (clampedValue === 1) {
      Animated.parallel([
        Animated.spring(springValue, {
          toValue: 1,
          stiffness: 150,
          damping: 35,
          useNativeDriver: false,
        }),
        Animated.timing(completionProgress, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // gentler spring for less bouncy rotation/fill motion on native
      Animated.spring(springValue, {
        toValue: clampedValue,
        stiffness: 200,
        damping: 28,
        useNativeDriver: false,
      }).start();
      completionProgress.setValue(0);
    }
  }, [value]);

  const radius = 6.5;
  const centerY = 9;
  const diameter = radius * 2;

  const fillHeight = springValue.interpolate({
    inputRange: [0, 0.8, 0.9, 1],
    outputRange: [0, diameter * 0.8, diameter * 0.82, diameter],
  });

  const fillY = springValue.interpolate({
    inputRange: [0, 0.8, 0.9, 1],
    outputRange: [centerY + radius, centerY - radius * 0.6, centerY - radius * 0.64, centerY - radius],
  });

  const strokeWidth = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const fillOpacity = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const cornerRadius = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [5.75, 3.75],
  });

  const checkDashoffset = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const checkOpacity = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Subtle checkmark scale to avoid jumpiness on native
  const checkScale = completionProgress.interpolate({
    inputRange: [0, 0.52, 0.77, 1],
    outputRange: [0.9, 1.02, 0.99, 1],
  });

  const getColor = (progress: number) => {
    if (progress < 0.52) return COLORS.primary7; // Red (theme)
    if (progress < 0.82) return COLORS.primary5; // Yellow (theme)
    return COLORS.primary6; // Green (theme)
  };

  const color = getColor(Math.max(0, Math.min(1, value)));

  const rectX = 3.25;
  const rectY = 3.25;
  const rectWidth = 11.5;
  const rectHeight = 11.5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 18 18" style={{ overflow: "visible" }}>
        <Defs>
          <ClipPath id={`rounded-rect-clip-${size}`}>
            <AnimatedRect x={rectX} y={rectY} width={rectWidth} height={rectHeight} rx={cornerRadius} />
          </ClipPath>
        </Defs>

        <G>
          {/* Filled portion (animates from bottom to top) */}
          <AnimatedRect
            x={rectX}
            y={fillY}
            width={rectWidth}
            height={fillHeight}
            fill={color}
            clipPath={`url(#rounded-rect-clip-${size})`}
            opacity={fillOpacity}
          />

          {/* Morphing stroke outline - rounded rectangle */}
          <AnimatedRect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={cornerRadius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </G>

        {/* Checkmark (complete state) - drawn animation */}
        <AnimatedPath
          d={svgPaths.p24bd7b90}
          stroke={COLORS.primary6}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[10, 10]}
          strokeDashoffset={checkDashoffset}
          opacity={checkOpacity}
          transform={[{ scale: checkScale }]}
          origin="9, 9"
        />
      </Svg>
    </View>
  );
}
