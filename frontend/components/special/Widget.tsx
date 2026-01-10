/**
 * Widget
 *
 * A fade-in entrance animated container using white3 background. Designed to be
 * triggered from TextBubble when typing animation reaches a certain point.
 * The widget displays content (typically form fields, category grid, etc.) and
 * supports both standard and entrance animations similar to CategoryGrid.
 *
 * Usage:
 * ```tsx
 * <Widget
 *   entranceEnabled={typingDone}
 *   entranceDelay={300}
 *   entranceDuration={400}
 * >
 *   <AppText>Widget Content</AppText>
 * </Widget>
 * ```
 */
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, StyleProp, ViewStyle } from "react-native";
import { COLORS, SPACING } from "../../theme";

type WidgetProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Entrance animation controls
  entranceEnabled?: boolean; // enable the widget entrance animation
  entranceDelay?: number; // ms delay before animation starts
  entranceDuration?: number; // ms duration of the fade-in animation
};

/**
 * Widget - A styled container with fade-in entrance animation.
 * Perfect for embedding in TextBubble or other components that need
 * animated content reveal.
 */
const Widget: React.FC<WidgetProps> = ({
  children,
  style,
  entranceEnabled = false,
  entranceDelay = 100,
  entranceDuration = 200,
}) => {
  const opacity = useRef(new Animated.Value(entranceEnabled ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(entranceEnabled ? 8 : 0)).current;

  useEffect(() => {
    if (!entranceEnabled) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: entranceDuration,
        delay: entranceDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: entranceDuration,
        delay: entranceDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceEnabled, entranceDelay, entranceDuration, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.widget,
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  widget: {
    width: "100%",
    backgroundColor: COLORS.white3,
    borderRadius: SPACING.lg,
    padding: SPACING.lg,
  },
});

export default Widget;
