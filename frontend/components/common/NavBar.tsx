import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useNavigation, TabName } from "../../context/NavigationContext";
import { useColors } from "../../context/ThemeContext";
import useKeyboard from "../../hooks/useKeyboard";
import GlassSurface from "./GlassSurface";

type NavBarProps = {
  show?: boolean;
  hideIcons?: boolean;
};

/**
 * NavBar
 *
 * Bottom navigation bar. It reads `navBarConfig` from `NavigationContext` to optionally
 * render widgets or a custom component. The bar animates in and out and adapts to
 * keyboard visibility for full-width behavior.
 */
export default function NavBar({ show = true, hideIcons = false }: NavBarProps) {
  const { activeTab, setActiveTab, navBarConfig } = useNavigation();
  const { visible: keyboardVisible } = useKeyboard();
  const colors = useColors();

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show && navBarConfig.show !== false) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [show, navBarConfig.show, opacityAnim, scaleAnim, translateYAnim]);

  // Animate when keyboard opens/closes
  useEffect(() => {
    Animated.spring(keyboardAnim, {
      toValue: keyboardVisible ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [keyboardVisible, keyboardAnim]);

  // Allow context to override the prop, but prop=false forces hide
  // Hide navbar when keyboard is open and there's no widget (e.g., chat input)
  if (!show || navBarConfig.show === false) return null;
  if (keyboardVisible && !navBarConfig.widget) return null;

  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? colors.primary1 : colors.gray1;
  };

  const widthStyle = keyboardVisible ? styles.fullWidth : {};

  const marginStyle = keyboardVisible ? {} : { marginHorizontal: SPACING.lg };

  const paddingStyle = keyboardVisible ? { paddingHorizontal: SPACING.lg } : {};

  // Use translateY to move navbar up when keyboard opens, simulating margin change
  const keyboardTranslateY = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SPACING.xlg - SPACING.lg + 3],
  });

  const cornerRadiusStyle = keyboardVisible
    ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderBottomLeftRadius: SPACING.xlg, borderBottomRightRadius: SPACING.xlg };

  return (
    <Animated.View
      style={[
        widthStyle,
        marginStyle,
        { marginBottom: SPACING.xlg },
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }, { translateY: Animated.add(translateYAnim, keyboardTranslateY) }],
        },
      ]}
    >
      <GlassSurface intensity={60} style={[styles.navBar, paddingStyle, cornerRadiusStyle]}>
        {/* Widget Area (e.g. Chat Input) */}
        {navBarConfig.widget && (
          <View style={[styles.widgetContainer, hideIcons ? styles.widgetContainerKeyboard : undefined]}>
            {navBarConfig.widget}
          </View>
        )}

        {/* Main Nav Content */}
        {shouldShowIcons && navBarConfig.customComponent ? (
          navBarConfig.customComponent
        ) : shouldShowIcons ? (
          <View style={styles.wrapper}>
            <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("user")}>
              <ICONS.user size={ICON_SIZES.big} color={getIconColor("user")} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("chat")}>
              <ICONS.ojo size={ICON_SIZES.big * 1.7} color={getIconColor("chat")} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => setActiveTab("calendar")}>
              <ICONS.calendar size={ICON_SIZES.big} color={getIconColor("calendar")} />
            </TouchableOpacity>
          </View>
        ) : null}
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    alignSelf: "stretch",
    borderRadius: SPACING.xlg,
    overflow: "hidden",
    ...(SHADOWS.card as object),
  },
  fullWidth: {
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
