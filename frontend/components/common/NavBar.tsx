import React, { useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Animated, Dimensions } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
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
  const keyboardAnim = useRef(new Animated.Value(keyboardVisible ? 1 : 0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      keyboardAnim.setValue(keyboardVisible ? 1 : 0);
      isFirstRender.current = false;
    } else {
      Animated.timing(keyboardAnim, {
        toValue: keyboardVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [keyboardVisible]);

  const marginHorizontalAnim = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SPACING.lg, 0],
  });

  const marginBottomAnim = keyboardAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [SPACING.xlg, SPACING.md],
    extrapolate: "clamp",
  });

  const paddingHorizontalAnim = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SPACING.lg],
  });

  const borderRadiusAnim = keyboardAnim.interpolate({
    inputRange: [0, 0.6],
    outputRange: [SPACING.xlg, 0],
    extrapolate: "clamp",
  });

  const paddingTopAnim = keyboardAnim.interpolate({
    inputRange: [0, 0.6],
    outputRange: [0, SPACING.xlg - SPACING.md],
    extrapolate: "clamp",
  });

  const widthAnim = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth - 2 * SPACING.lg, screenWidth],
  });

  // Increase navbar height early in the animation so the white background fills
  // the gap between the expanding keyboard and the component.
  const baseHeight = SPACING.xlg * 2.5;
  const extraHeight = SPACING.xlg;
  const heightAnim = keyboardAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [baseHeight, baseHeight + extraHeight],
    extrapolate: 'clamp',
  });

  const widgetTranslateY = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SPACING.lg],
  });

  // Allow context to override the prop, but prop=false forces hide
  if (!show || navBarConfig.show === false) return null;
  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? COLORS.primary1 : COLORS.lightGray;
  };

  return (
    <Animated.View
      style={[
        styles.navBar,
        {
          width: widthAnim,
          marginLeft: marginHorizontalAnim,
          marginRight: marginHorizontalAnim,
          marginBottom: marginBottomAnim,
          paddingLeft: paddingHorizontalAnim,
          paddingRight: paddingHorizontalAnim,
          paddingTop: paddingTopAnim,
          borderBottomLeftRadius: borderRadiusAnim,
          borderBottomRightRadius: borderRadiusAnim,
        },
      ]}
    >
      {/* Widget Area (e.g. Chat Input) */}
      {navBarConfig.widget && (
        <Animated.View
          style={[
            styles.widgetContainer,
            { transform: [{ translateY: widgetTranslateY }] },
            hideIcons ? styles.widgetContainerKeyboard : undefined,
          ]}
        >
          {navBarConfig.widget}
        </Animated.View>
      )}

      {/* Main Nav Content */}
      {shouldShowIcons && navBarConfig.customComponent ? (
        navBarConfig.customComponent
      ) : shouldShowIcons ? (
        <Animated.View style={[styles.wrapper, { height: heightAnim }]}>
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
  );
}

const styles = StyleSheet.create({
  navBar: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.xlg,
    ...(SHADOWS.card as object),
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
