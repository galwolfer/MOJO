import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
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

  // Allow context to override the prop, but prop=false forces hide
  if (!show || navBarConfig.show === false) return null;
  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? COLORS.primary1 : COLORS.lightGray;
  };

  const widthStyle = keyboardVisible ? styles.fullWidth : {};

  const marginStyle = keyboardVisible ? {} : { marginHorizontal: SPACING.lg };

  const paddingStyle = keyboardVisible ? { paddingHorizontal: SPACING.lg } : {};

  const cornerRadiusStyle = keyboardVisible
    ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderBottomLeftRadius: SPACING.xlg, borderBottomRightRadius: SPACING.xlg };

  return (
    <View style={[styles.navBar, widthStyle, marginStyle, paddingStyle, cornerRadiusStyle]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    alignSelf: "stretch",
    marginBottom: SPACING.xlg,
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
