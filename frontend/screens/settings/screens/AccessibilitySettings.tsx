import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { ICONS } from "../../../components/icons/icons";
import { useAccessibilityPreferences } from "../../../hooks/useAccessibilityPreferences";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import List, { type ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import ErrorText from "../../../components/common/ErrorText";
import TimeFormatScreen from "./TimeFormat";
import ThemeModeScreen from "./ThemeMode";
import SettingsSubScreen from "./components/SettingsSubScreen";

type AccessibilitySettingsScreenProps = { onBack: () => void };
type CurrentScreen = "main" | "time-format" | "theme-mode";

export default function AccessibilitySettingsScreen({ onBack }: AccessibilitySettingsScreenProps) {
  const colors = useColors();
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>("main");
  const { preferences, isLoading, error } = useAccessibilityPreferences();

  if (currentScreen === "time-format") return <TimeFormatScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "theme-mode")  return <ThemeModeScreen  onBack={() => setCurrentScreen("main")} />;

  const ClockIcon   = ICONS.clock;
  const PaletteIcon = preferences.theme === "dark" ? ICONS.night : ICONS.day;

  const items: ListCellProps[] = [
    makeListCell("theme-mode", {
      title: "Theme Mode",
      subtitle: preferences.theme === "dark" ? "Dark Mode" : preferences.theme === "light" ? "Light Mode" : "System Default",
      logo: <PaletteIcon size={ICON_SIZES.sm} color={preferences.theme === "dark" ? COLORS.primary1 : COLORS.primary5} />,
      onPress: () => setCurrentScreen("theme-mode"), divider: true,
    }),
    makeListCell("time-format", {
      title: "Time Format",
      subtitle: preferences.timeFormat === "12h" ? "12-Hour (2:30 PM)" : "24-Hour (14:30)",
      logo: <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary2} />,
      onPress: () => setCurrentScreen("time-format"), divider: false,
    }),
  ];

  return (
    <SettingsSubScreen title="Accessibility" iconName="settings" scrollKey="accessibility-settings" onBack={onBack}>
      {error && <ErrorText>{error}</ErrorText>}

      {isLoading ? (
        <View style={styles.loading}>
          <AppText variant="notes" style={{ color: colors.gray1 }}>Loading preferences…</AppText>
        </View>
      ) : (
        <Box>
          <View style={styles.listContent}>
            <List data={items} />
          </View>
        </Box>
      )}
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loading:     { padding: SPACING.lg, alignItems: "center" },
  listContent: { width: "100%", paddingVertical: SPACING.sm },
});
