/**
 * ThemeModeScreen
 *
 * Allows users to select between light and dark theme modes.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useNavigation } from "../../../context/NavigationContext";
import { ICONS } from "../../../components/icons/icons";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import { useAccessibilityPreferences, ThemeMode } from "../../../hooks/useAccessibilityPreferences";
import { useTheme, useColors } from "../../../context/ThemeContext";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import List, { ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import ErrorText from "../../../components/common/ErrorText";

type ThemeModeScreenProps = {
  onBack: () => void;
};

export default function ThemeModeScreen({ onBack }: ThemeModeScreenProps) {
  const { setHeaderConfig } = useNavigation();
  const { preferences, isLoading, error } = useAccessibilityPreferences();
  const { setTheme } = useTheme();
  const colors = useColors();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(preferences.theme || "light");
  const [isSaving, setIsSaving] = useState(false);

  const LeftIcon = ICONS.left;
  const ThemeIcon = ICONS.settings;

  useEffect(() => {
    setHeaderConfig({
      title: "Theme Mode",
      show: true,
      icon: ICONS.settings,
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerIcon}>
          <ThemeIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  useEffect(() => {
    if (preferences.theme) {
      setSelectedTheme(preferences.theme);
    }
  }, [preferences.theme]);

  const handleThemeSelect = async (theme: ThemeMode) => {
    if (isSaving || theme === selectedTheme) return;

    try {
      setIsSaving(true);
      setSelectedTheme(theme);
      console.log(`[ThemeModeScreen] Requesting theme change => ${theme}`);
      await setTheme(theme);
      console.log(`[ThemeModeScreen] Theme change applied => ${theme}`);
    } catch (err) {
      console.error("[ThemeModeScreen] Failed to apply theme:", err);
      // Revert selection on error
      setSelectedTheme(preferences.theme || "light");
    } finally {
      setIsSaving(false);
    }
  };

  const SunIcon = ICONS.home; // Replace with actual sun/light icon
  const MoonIcon = ICONS.calendar; // Replace with actual moon/dark icon
  const CheckIcon = ICONS.check;

  const themeItems: ListCellProps[] = [
    makeListCell("light", {
      title: "Light Mode",
      subtitle: "Bright, clean interface",
      logo: <SunIcon size={ICON_SIZES.sm} color={COLORS.primary5} />,
      onPress: () => handleThemeSelect("light"),
      divider: true,
      rightElement: selectedTheme === "light" ? <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} /> : null,
    }),
    makeListCell("dark", {
      title: "Dark Mode",
      subtitle: "Easy on the eyes",
      logo: <MoonIcon size={ICON_SIZES.sm} color={COLORS.primary3} />,
      onPress: () => handleThemeSelect("dark"),
      divider: false,
      rightElement: selectedTheme === "dark" ? <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} /> : null,
    }),
  ];

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="theme-mode-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      {error && <ErrorText>{error}</ErrorText>}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <AppText variant="notes" style={[styles.loadingText, { color: colors.gray1 }]}>
            Loading theme settings...
          </AppText>
        </View>
      ) : (
        <Box>
          <View style={styles.listContent}>
            <List data={themeItems} />
          </View>
        </Box>
      )}

      {isSaving && (
        <View style={styles.savingContainer}>
          <AppText variant="notes" style={styles.savingText}>
            Saving...
          </AppText>
        </View>
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

  loadingContainer: {
    padding: SPACING.lg,
    alignItems: "center",
  },

  loadingText: {},

  listContent: {
    width: "100%",
    paddingVertical: SPACING.sm,
  },

  savingContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: "center",
  },

  savingText: {
    color: COLORS.primary1,
  },
});
