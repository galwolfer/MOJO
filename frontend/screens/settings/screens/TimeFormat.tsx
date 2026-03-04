/**
 * TimeFormatScreen
 *
 * Screen for selecting time format preference (12-hour vs 24-hour).
 */

import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { useNavigation } from "../../../context/NavigationContext";
import { ICONS } from "../../../components/icons/icons";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import { useAccessibilityPreferences, TimeFormat } from "../../../hooks/useAccessibilityPreferences";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import ErrorText from "../../../components/common/ErrorText";
import { RadioButton, RadioButtonGroup, RadioButtonOption } from "../../../components/common/RadioButton";

type TimeFormatScreenProps = {
  onBack: () => void;
};

export default function TimeFormatScreen({ onBack }: TimeFormatScreenProps) {
  const colors = useColors();
  const { setHeaderConfig } = useNavigation();
  const { preferences, setTimeFormat, isLoading, error } = useAccessibilityPreferences();

  const LeftIcon = ICONS.left;
  const ClockIcon = ICONS.clock;

  useEffect(() => {
    setHeaderConfig({
      title: "Time Format",
      show: true,
      icon: ICONS.settings,
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerIcon}>
          <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  const timeFormatOptions: RadioButtonOption[] = [
    {
      id: "12h",
      label: "12-Hour Format",
      description: "2:30 PM, 9:00 AM",
      value: "12h",
    },
    {
      id: "24h",
      label: "24-Hour Format",
      description: "14:30, 09:00",
      value: "24h",
    },
  ];

  const handleTimeFormatSelect = async (id: string, value: TimeFormat) => {
    try {
      await setTimeFormat(value);
    } catch (err) {
      console.error("[TimeFormatScreen] Failed to update time format:", err);
    }
  };

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="time-format-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      <Box>
        <View style={styles.boxContent}>
          <AppText variant="notes">Choose how times are displayed throughout the app</AppText>

          {error && <ErrorText>{error}</ErrorText>}

          <RadioButtonGroup
            options={timeFormatOptions}
            selectedId={preferences.timeFormat}
            onSelect={(id, value) => handleTimeFormatSelect(id, value as TimeFormat)}
          />
        </View>
      </Box>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.lg,
  },

  headerTouchable: {
    padding: SPACING.xs,
  },

  headerIcon: {
    padding: SPACING.xs,
  },

  boxContent: {
    gap: SPACING.md,
  },

  previewContainer: {
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  previewItem: {
    gap: SPACING.sm,
  },

  previewLabel: {
    fontSize: 12,
  },

  previewTime: {
    color: COLORS.primary1,
    fontSize: 18,
  },

  divider: {
    height: 1,
  },
});
