import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, StyleProp, ViewStyle } from "react-native";

interface ExpandableRowProps {
  expanded: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const ExpandableRow: React.FC<ExpandableRowProps> = ({ expanded, duration = 220, style, children }) => {
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const height = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (contentHeight == null) return;

    if (expanded) {
      Animated.parallel([
        Animated.timing(height, {
          toValue: contentHeight,
          duration: Math.max(160, duration),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: Math.max(120, duration - 20),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: Math.max(100, duration - 40),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: 0,
          duration: Math.max(140, duration - 20),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [expanded, contentHeight, duration, height, opacity]);

  const measuring = contentHeight == null;

  return (
    <Animated.View
      style={[
        {
          overflow: "hidden",
          ...(measuring
            ? {
                position: "absolute",
                left: 0,
                right: 0,
                opacity: 0,
              }
            : { height, opacity }),
        },
        style as any,
      ]}
      pointerEvents={expanded && !measuring ? "auto" : "none"}
    >
      <View
        onLayout={(e) => {
          const h = Math.ceil(e.nativeEvent.layout.height);
          if (h > 0 && h !== contentHeight) {
            setContentHeight(h);
            if (!expanded) {
              height.setValue(0);
              opacity.setValue(0);
            }
          }
        }}
        collapsable={false}
      >
        {children}
      </View>
    </Animated.View>
  );
};

export default ExpandableRow;
