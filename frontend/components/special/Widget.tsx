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
  skipAnimation?: boolean; // skip animation entirely (e.g., when returning to a screen)
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
  skipAnimation = false,
}) => {
  // Don't render until entrance is requested to avoid showing content early.
  const [mounted, setMounted] = React.useState<boolean>(entranceEnabled || skipAnimation);
  // Track if this is the first time the component is being shown
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (entranceEnabled || skipAnimation) setMounted(true);
  }, [entranceEnabled, skipAnimation]);

  // If not mounted yet, render nothing (prevents early flash / layout shift)
  if (!mounted) return null;

  const opacity = useRef(new Animated.Value(skipAnimation ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(skipAnimation ? 0 : 8)).current;

  useEffect(() => {
    // If skipAnimation is true, show immediately without animation
    if (skipAnimation) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    if (!entranceEnabled) {
      // If entrance is not enabled but we are mounted (someone forced mount), make it visible immediately
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    // Skip animation if this is not the first mount (e.g., returning from navigation)
    if (!isFirstMountRef.current) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    // Mark that we've done the animation at least once
    isFirstMountRef.current = false;

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
  }, [entranceEnabled, entranceDelay, entranceDuration, skipAnimation, opacity, translateY]);

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
