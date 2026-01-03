import React, { useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES, COMPONENT_STYLES } from "../../theme";
import GlassSurface from "./GlassSurface";
import { useNavigation, TabName } from "../../context/NavigationContext";
import useKeyboard from "../../hooks/useKeyboard";

type NavBarProps = {
  show?: boolean;
  hideIcons?: boolean;
};

export default function NavBar({ show = true, hideIcons = false }: NavBarProps) {
  const { activeTab, setActiveTab, navBarConfig } = useNavigation();
  const { visible: keyboardVisible } = useKeyboard();

  const screenWidth = Dimensions.get("window").width;
  const keyboardAnim = useSharedValue(keyboardVisible ? 1 : 0);

  // Increase navbar height early in the animation so the white background fills
  // the gap between the expanding keyboard and the component.
  const baseHeight = SPACING.xlg * 2.5;
  const extraHeight = SPACING.xlg;

  useEffect(() => {
    keyboardAnim.value = withTiming(keyboardVisible ? 1 : 0, { duration: 300 });
  }, [keyboardVisible]);

  const navBarAnimatedStyle = useAnimatedStyle(() => {
    const value = keyboardAnim.value;
    return {
      width: screenWidth - 2 * SPACING.lg + (value * 2 * SPACING.lg),
      marginLeft: SPACING.lg - (value * SPACING.lg),
      marginRight: SPACING.lg - (value * SPACING.lg),
      marginBottom: value <= 0.3 ? SPACING.xlg - (value / 0.3 * (SPACING.xlg - SPACING.md)) : SPACING.md,
      borderBottomLeftRadius: value <= 0.6 ? SPACING.xlg * (1 - value / 0.6) : 0,
      borderBottomRightRadius: value <= 0.6 ? SPACING.xlg * (1 - value / 0.6) : 0,
    };
  });

  const blurSurfaceAnimatedStyle = useAnimatedStyle(() => {
    const value = keyboardAnim.value;
    return {
      paddingLeft: value * SPACING.lg,
      paddingRight: value * SPACING.lg,
      paddingTop: value <= 0.6 ? value / 0.6 * (SPACING.xlg - SPACING.md) : SPACING.xlg - SPACING.md,
    };
  });

  const widgetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardAnim.value * -SPACING.lg }],
  }));

  const wrapperAnimatedStyle = useAnimatedStyle(() => {
    const value = keyboardAnim.value;
    return {
      height: value <= 0.3 ? baseHeight + (value / 0.3 * extraHeight) : baseHeight + extraHeight,
    };
  });

  // Allow context to override the prop, but prop=false forces hide
  if (!show || navBarConfig.show === false) return null;
  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? COLORS.primary1 : COLORS.lightGray;
  };

  return (
    <Animated.View
      style={[styles.navBar, navBarAnimatedStyle]}
    >
      <GlassSurface intensity={50} pointerEvents="none" style={[styles.glassFill, COMPONENT_STYLES.glassSurface]} />
      <Animated.View style={[styles.content, blurSurfaceAnimatedStyle]}>
      {/* Widget Area (e.g. Chat Input) */}
      {navBarConfig.widget && (
        <Animated.View
          style={[styles.widgetContainer, widgetAnimatedStyle, hideIcons ? styles.widgetContainerKeyboard : undefined]}
        >
          {navBarConfig.widget}
        </Animated.View>
      )}

      {/* Main Nav Content */}
      {shouldShowIcons && navBarConfig.customComponent ? (
        navBarConfig.customComponent
      ) : shouldShowIcons ? (
        <Animated.View style={[styles.wrapper, wrapperAnimatedStyle]}>
          <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("user")}>
            <ICONS.user size={ICON_SIZES.big} color={getIconColor("user")} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("chat")}>
            <ICONS.ojo size={ICON_SIZES.big * 1.7} color={getIconColor("chat")} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("calendar")}>
            <ICONS.calendar size={ICON_SIZES.big} color={getIconColor("calendar")} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    borderRadius: SPACING.xlg,
    ...(SHADOWS.card as object),
    overflow: "hidden",
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SPACING.xlg,
  },
  content: {
    width: "100%",
  },
  widgetContainer: {
    width: "100%",
    marginBottom: -SPACING.lg,
  },
  widgetContainerKeyboard: {
    paddingBottom: SPACING.md,
  },
  wrapper: {
    height: SPACING.xlg * 2.5,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
