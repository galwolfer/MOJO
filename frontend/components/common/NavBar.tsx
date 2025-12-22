import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useNavigation, TabName } from "../../context/NavigationContext";

type NavBarProps = {
  show?: boolean;
  hideIcons?: boolean;
};

export default function NavBar({ show = true, hideIcons = false }: NavBarProps) {
  const { activeTab, setActiveTab, navBarConfig } = useNavigation();

  // Allow context to override the prop, but prop=false forces hide
  if (!show || navBarConfig.show === false) return null;
  const shouldShowIcons = !hideIcons;

  const getIconColor = (tab: TabName) => {
    return activeTab === tab ? COLORS.primary1 : COLORS.lightGray;
  };

  return (
    <View style={[styles.navBar, hideIcons ? styles.navBarCompact : undefined]}>
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
    width: "100%",
    alignSelf: "stretch",
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SPACING.xlg,
    borderTopRightRadius: SPACING.xlg,
    ...(SHADOWS.card as object),
  },
  navBarCompact: {
    paddingTop: SPACING.sm,
  },
  widgetContainer: {
    width: "100%",
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  widgetContainerKeyboard: {
    paddingBottom: SPACING.xlg,
  },
  wrapper: {
    height: SPACING.xlg * 3 + (Platform.OS !== "web" ? SPACING.lg : 0),
    paddingBottom: Platform.OS === "web" ? 0 : SPACING.lg,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
