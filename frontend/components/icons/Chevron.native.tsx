import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";
import { COLORS } from "../../theme";

interface ChevronProps {
  isOpen: boolean;
  size?: number;
  color?: string;
}

export const Chevron = ({ isOpen, size = 17, color = COLORS.primary1 }: ChevronProps) => {
  // Key coordinates derived from the paths
  // Down state (V) - "M1.25 1.25 L5.99 6.67 C7.19 8.04 9.31 8.04 10.51 6.67 L15.25 1.25"
  const startY_Tip = 1.25;
  const startY_Base = 6.67;
  const startY_Control = 8.04;

  // Up state (^) - "M1.25 7.92 L5.99 2.5 C7.19 1.13 9.31 1.13 10.51 2.5 L15.25 7.92"
  const endY_Tip = 7.92;
  const endY_Base = 2.5;
  const endY_Control = 1.13;

  // X coordinates (constant)
  const x1 = 1.25;
  const x2 = 5.99;
  const cx1 = 7.19;
  const cx2 = 9.31;
  const x3 = 10.51;
  const x4 = 15.25;

  // Helper to generate path string
  const getPath = (progress: number) => {
    const yTip = startY_Tip + (endY_Tip - startY_Tip) * progress;
    const yBase = startY_Base + (endY_Base - startY_Base) * progress;
    const yControl = startY_Control + (endY_Control - startY_Control) * progress;

    return `M${x1} ${yTip} L${x2} ${yBase} C${cx1} ${yControl} ${cx2} ${yControl} ${x3} ${yBase} L${x4} ${yTip}`;
  };

  const [d, setD] = useState(() => getPath(isOpen ? 1 : 0));
  const anim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    const toValue = isOpen ? 1 : 0;

    Animated.timing(anim, {
      toValue,
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();

    const id = anim.addListener(({ value }) => {
      setD(getPath(value));
    });

    return () => {
      anim.removeListener(id);
    };
  }, [isOpen]);

  return (
    <Svg width={size} height={size * (9 / 17)} viewBox="0 0 17 9" fill="none">
      <Path d={d} stroke={color} strokeLinecap="round" strokeWidth="2.5" />
    </Svg>
  );
};
