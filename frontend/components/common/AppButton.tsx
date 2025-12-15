import React, { useRef } from "react";
import { Pressable, View, StyleSheet, Animated, Easing } from "react-native";
import AppText from "./AppText";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from "../../theme";

export type AppButtonProps = {
  title?: string;
  onPress?: () => void;
  icon?: string; // key from ICONS map
  width?: number | string;
  iconPosition?: "left" | "right";
  mode?: "filled" | "light";
  color?: keyof typeof COLORS | string;
  style?: any;
  disabled?: boolean;
  testID?: string;
};

/**
 * AppButton
 * - Supports an icon (from `frontend/components/icons/icons.tsx`) on the left or right
 * - Two modes: `filled` and `light`
 * - Color can be a key from `COLORS` in `frontend/theme.ts` or any color string
 * - Uses `SHADOWS.card` to match app surfaces
 */
const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  icon,
  width,
  iconPosition = "left",
  mode = "filled",
  color = "primary1",
  style,
  disabled,
  testID,
}) => {
  const resolvedColor = (COLORS as any)[color] || (typeof color === "string" ? color : COLORS.primary1);
  const isFilled = mode === "filled";

  const IconComp = icon && (ICONS as any)[icon] ? (ICONS as any)[icon] : null;

  const containerStyle = [
    styles.container,
    isFilled
      ? { backgroundColor: resolvedColor, borderWidth: 2.5, borderColor: resolvedColor }
      : { backgroundColor: "transparent", borderWidth: 2.5, borderColor: resolvedColor },
    // allow width prop to override static style
    width === "100%" ? { width: "100%", alignSelf: "stretch" as any } : width != null ? { width } : {},
    SHADOWS.card as object,
    style,
  ];

  const textStyle = [
    { color: isFilled ? COLORS.colorWhite : resolvedColor, fontFamily: (TYPOGRAPHY.boldText as any).fontFamily },
  ];

  const anim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 0.97,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          transform: [{ scale: anim }],
          opacity: anim.interpolate({ inputRange: [0.97, 1], outputRange: [0.95, 1] }),
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        testID={testID}
        style={[styles.content, width === "100%" ? { width: "100%" } : undefined]}
      >
        {IconComp && iconPosition === "left" && (
          <View style={styles.iconWrapper}>
            <IconComp size={20} color={isFilled ? COLORS.colorWhite : resolvedColor} />
          </View>
        )}

        {title ? (
          <AppText variant="boldText" style={textStyle}>
            {title}
          </AppText>
        ) : null}

        {IconComp && iconPosition === "right" && (
          <View style={styles.iconWrapper}>
            <IconComp size={20} color={isFilled ? COLORS.colorWhite : resolvedColor} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: SPACING.xlg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  iconWrapper: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

export default AppButton;
