import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACING } from "../../../theme";
import { useAccessibilityPreferences, type TimeFormat } from "../../../hooks/useAccessibilityPreferences";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import ErrorText from "../../../components/common/ErrorText";
import { RadioButtonGroup, type RadioButtonOption } from "../../../components/common/RadioButton";
import SettingsSubScreen from "./components/SettingsSubScreen";

type TimeFormatScreenProps = { onBack: () => void };

export default function TimeFormatScreen({ onBack }: TimeFormatScreenProps) {
  const { preferences, setTimeFormat, error } = useAccessibilityPreferences();

  const timeFormatOptions: RadioButtonOption[] = [
    { id: "12h", label: "12-Hour Format", description: "2:30 PM, 9:00 AM", value: "12h" },
    { id: "24h", label: "24-Hour Format", description: "14:30, 09:00",      value: "24h" },
  ];

  const handleSelect = async (_id: string, value: TimeFormat) => {
    try {
      await setTimeFormat(value);
    } catch (err) {
      console.error("[TimeFormatScreen] Failed to update time format:", err);
    }
  };

  return (
    <SettingsSubScreen
      title="Time Format"
      iconName="clock"
      scrollKey="time-format-settings"
      onBack={onBack}
      contentContainerStyle={styles.extra}
    >
      <Box>
        <View style={styles.boxContent}>
          <AppText variant="notes">Choose how times are displayed throughout the app</AppText>
          {error && <ErrorText>{error}</ErrorText>}
          <RadioButtonGroup
            options={timeFormatOptions}
            selectedId={preferences.timeFormat}
            onSelect={(id, value) => handleSelect(id, value as TimeFormat)}
          />
        </View>
      </Box>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  extra:     { gap: SPACING.lg },
  boxContent: { gap: SPACING.md },
});
