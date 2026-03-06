import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useAccessibilityPreferences, type ThemeMode } from "../../../hooks/useAccessibilityPreferences";
import { useTheme, useColors } from "../../../context/ThemeContext";
import { ICONS } from "../../../components/icons/icons";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import List, { type ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import ErrorText from "../../../components/common/ErrorText";
import SettingsSubScreen from "./components/SettingsSubScreen";

type ThemeModeScreenProps = { onBack: () => void };

export default function ThemeModeScreen({ onBack }: ThemeModeScreenProps) {
  const { preferences, isLoading, error } = useAccessibilityPreferences();
  const { setTheme } = useTheme();
  const colors = useColors();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(preferences.theme || "system");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (preferences.theme) setSelectedTheme(preferences.theme);
  }, [preferences.theme]);

  const handleThemeSelect = async (theme: ThemeMode) => {
    if (isSaving || theme === selectedTheme) return;
    try {
      setIsSaving(true);
      setSelectedTheme(theme);
      await setTheme(theme);
    } catch {
      setSelectedTheme(preferences.theme || "system");
    } finally {
      setIsSaving(false);
    }
  };

  const CheckIcon = ICONS.check;
  const SunIcon = ICONS.day;
  const MoonIcon = ICONS.night;
  const SystemIcon = ICONS.settings;

  const themeItems: ListCellProps[] = [
    makeListCell("system", {
      title: "System Default",
      subtitle: "Follows your device setting",
      logo: <SystemIcon size={ICON_SIZES.sm} color={COLORS.primary3} />,
      onPress: () => handleThemeSelect("system"),
      divider: true,
      rightElement: selectedTheme === "system" ? <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} /> : null,
    }),
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
      logo: <MoonIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
      onPress: () => handleThemeSelect("dark"),
      divider: false,
      rightElement: selectedTheme === "dark" ? <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} /> : null,
    }),
  ];

  return (
    <SettingsSubScreen title="Theme Mode" iconName="settings" scrollKey="theme-mode-settings" onBack={onBack}>
      {error && <ErrorText>{error}</ErrorText>}

      {isLoading ? (
        <View style={styles.loading}>
          <AppText variant="notes" style={{ color: colors.gray1 }}>
            Loading theme settings�
          </AppText>
        </View>
      ) : (
        <Box>
          <View style={styles.listContent}>
            <List data={themeItems} />
          </View>
        </Box>
      )}
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: SPACING.lg, alignItems: "center" },
  listContent: { width: "100%", paddingVertical: SPACING.sm },
  saving: { marginTop: SPACING.md, padding: SPACING.md, alignItems: "center" },
});
