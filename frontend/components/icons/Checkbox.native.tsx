/**
 * Checkbox (native)
 *
 * Native animated checkbox using `Animated` + `react-native-svg`.
 * Matches the web checkbox's visual language but uses native animation
 * primitives for performance on mobile.
 */
import React, { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, Easing } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import svgPaths from "../../assets/imports/svg-kilf0jp2lv";
import { COLORS } from "../../theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  size?: number;
}

/**
 * Checkbox - Animated checkbox control for native platforms.
 * @param checked - Whether the checkbox is checked.
 * @param onChange - Callback when the checkbox state changes.
 * @param size - The size of the checkbox.
 */
export function Checkbox({ checked, onChange, size = 18 }: CheckboxProps) {
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // SVG props often require JS driver
      easing: Easing.out(Easing.ease),
    }).start();
  }, [checked]);

  const strokeColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.lightGray, COLORS.primary6],
  });

  const checkDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const checkOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkScale = progress.interpolate({
    inputRange: [0, 0.5, 0.75, 1],
    outputRange: [0.9, 1.02, 0.99, 1], // subtle pop-in, much less bouncy
  });

  const handleClick = () => {
    if (onChange) {
      onChange(!checked);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleClick}
      activeOpacity={1}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 18 18" style={{ overflow: "visible" }}>
        {/* Checkbox border - hollow rounded square */}
        <AnimatedRect
          x="3.25"
          y="3.25"
          width="11.5"
          height="11.5"
          rx="3.75"
          stroke={strokeColor}
          strokeWidth="2.5"
          fill="none"
        />

        {/* Checkmark (drawn animation) */}
        <AnimatedPath
          d={svgPaths.p24bd7b90}
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[10, 10]}
          strokeDashoffset={checkDashoffset}
          opacity={checkOpacity}
          transform={[{ scale: checkScale }]}
          originX={9}
          originY={9}
        />
      </Svg>
    </TouchableOpacity>
  );
}
