/**
 * AccessibilitySettingsScreen
 *
 * Dedicated screen for managing accessibility preferences.
 * Handles navigation between main accessibility settings and specific setting screens.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { useNavigation } from "../../../context/NavigationContext";
import { ICONS } from "../../../components/icons/icons";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import { useAccessibilityPreferences } from "../../../hooks/useAccessibilityPreferences";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import List, { ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import TimeFormatScreen from "./TimeFormat";
import ThemeModeScreen from "./ThemeMode";
import ErrorText from "../../../components/common/ErrorText";

type AccessibilitySettingsScreenProps = {
  onBack: () => void;
};

type CurrentScreen = "main" | "time-format" | "theme-mode";

export default function AccessibilitySettingsScreen({ onBack }: AccessibilitySettingsScreenProps) {
  const colors = useColors();
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>("main");
  const { setHeaderConfig } = useNavigation();

  const LeftIcon = ICONS.left;
  const AccessibilityIcon = ICONS.settings;

  // Setup header when on main screen
  useEffect(() => {
    if (currentScreen === "main") {
      setHeaderConfig({
        title: "Accessibility",
        show: true,
        icon: ICONS.settings,
        leftElement: (
          <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
            <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
          </TouchableOpacity>
        ),
        rightElement: (
          <View style={styles.headerIcon}>
            <AccessibilityIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
          </View>
        ),
      });
    }
  }, [currentScreen]);

  // Always call hooks in the same order
  const { preferences, isLoading, error } = useAccessibilityPreferences();

  // Render time format settings screen
  if (currentScreen === "time-format") {
    return <TimeFormatScreen onBack={() => setCurrentScreen("main")} />;
  }

  // Render theme mode settings screen
  if (currentScreen === "theme-mode") {
    return <ThemeModeScreen onBack={() => setCurrentScreen("main")} />;
  }

  const ClockIcon = ICONS.clock;
  // choose a sun or moon icon depending on the current theme preference
  const PaletteIcon = preferences.theme === "dark" ? ICONS.night : ICONS.day;

  const accessibilityItems: ListCellProps[] = [
    makeListCell("theme-mode", {
      title: "Theme Mode",
      subtitle:
        preferences.theme === "dark" ? "Dark Mode" : preferences.theme === "light" ? "Light Mode" : "System Default",
      logo: (
        <PaletteIcon size={ICON_SIZES.sm} color={preferences.theme === "dark" ? COLORS.primary1 : COLORS.primary5} />
      ),
      onPress: () => setCurrentScreen("theme-mode"),
      divider: true,
    }),
    makeListCell("time-format", {
      title: "Time Format",
      subtitle: preferences.timeFormat === "12h" ? "12-Hour (2:30 PM)" : "24-Hour (14:30)",
      logo: <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary2} />,
      onPress: () => setCurrentScreen("time-format"),
      divider: false,
    }),
  ];

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="accessibility-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      {error && <ErrorText>{error}</ErrorText>}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <AppText variant="notes" style={[styles.loadingText, { color: colors.gray1 }]}>
            Loading preferences...
          </AppText>
        </View>
      )}

      {!isLoading && (
        <Box>
          <View style={styles.listContent}>
            <List data={accessibilityItems} />
          </View>
        </Box>
      )}
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: SPACING.md,
  },

  headerTouchable: {
    padding: SPACING.xs,
  },

  headerIcon: {
    padding: SPACING.xs,
  },

  // Accessibility list styles
  errorContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.primary6 + "15",
    borderRadius: 8,
    marginBottom: SPACING.md,
  },

  errorText: {
    color: COLORS.primary6,
  },

  loadingContainer: {
    padding: SPACING.lg,
    alignItems: "center",
  },

  loadingText: {},

  listContent: {
    width: "100%",
    paddingVertical: SPACING.sm,
  },
});
