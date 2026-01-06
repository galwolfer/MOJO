import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useNavigation, TabName } from "../../context/NavigationContext";
import useKeyboard from "../../hooks/useKeyboard";

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

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

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

  // Allow context to override the prop, but prop=false forces hide
  if (!show || navBarConfig.show === false) return null;
  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? COLORS.primary1 : COLORS.lightGray;
  };

  const widthStyle = keyboardVisible ? styles.fullWidth : {};

  const marginStyle = keyboardVisible ? {} : { marginHorizontal: SPACING.lg };

  const paddingStyle = keyboardVisible ? { paddingHorizontal: SPACING.lg } : {};

  const mbStyle = keyboardVisible ? { marginBottom: SPACING.lg - 4 } : { marginBottom: SPACING.xlg };
  const cornerRadiusStyle = keyboardVisible
    ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderBottomLeftRadius: SPACING.xlg, borderBottomRightRadius: SPACING.xlg };

  return (
    <Animated.View
      style={[
        styles.navBar,
        widthStyle,
        marginStyle,
        paddingStyle,
        mbStyle,
        cornerRadiusStyle,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
        },
      ]}
    >
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    alignSelf: "stretch",
    backgroundColor: COLORS.white,
    borderRadius: SPACING.xlg,
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
