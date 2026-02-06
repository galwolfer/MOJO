/**
 * AccessibilitySettings Component
 *
 * A settings panel for managing accessibility preferences like time format.
 * Matches the styling of other settings screens (ChatSettings, NotificationSettings, etc.)
 */

import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { useAccessibilityPreferences, TimeFormat } from "../../hooks/useAccessibilityPreferences";
import { COLORS, SPACING, FONT_SIZES } from "../../theme";
import AppText from "../common/AppText";
import Box from "../layout/Box";

type AccessibilitySettingsProps = {
  style?: any;
};

export default function AccessibilitySettings({ style }: AccessibilitySettingsProps) {
  const { preferences, isLoading, error, setTimeFormat } = useAccessibilityPreferences();

  const handleTimeFormatChange = async (format: TimeFormat) => {
    try {
      await setTimeFormat(format);
    } catch (err) {
      console.error("[AccessibilitySettings] Failed to update time format:", err);
    }
  };

  return (
    <Box style={[styles.container, style]}>
      {error && (
        <View style={styles.errorContainer}>
          <AppText variant="notes" style={styles.errorText}>
            {error}
          </AppText>
        </View>
      )}

      {/* Time Format Section */}
      <View style={styles.section}>
        <AppText variant="boldText" style={styles.sectionLabel}>
          🕐 Time Format
        </AppText>
        <AppText variant="notes" style={styles.sectionDescription}>
          Choose how times are displayed throughout the app
        </AppText>

        <View style={styles.optionsContainer}>
          {/* 12-hour format option */}
          <TouchableOpacity
            style={[styles.optionButton, preferences.timeFormat === "12h" && styles.optionButtonActive]}
            onPress={() => handleTimeFormatChange("12h")}
            accessibilityRole="button"
            accessibilityState={{ selected: preferences.timeFormat === "12h" }}
          >
            <View style={styles.optionContent}>
              <AppText
                variant="boldText"
                style={[styles.optionTitle, preferences.timeFormat === "12h" && styles.optionTitleActive]}
              >
                12-Hour Format
              </AppText>
              <AppText
                variant="notes"
                style={[styles.optionDescription, preferences.timeFormat === "12h" && styles.optionDescriptionActive]}
              >
                2:30 PM, 9:00 AM
              </AppText>
            </View>
            {preferences.timeFormat === "12h" && (
              <View style={styles.checkmark}>
                <AppText style={styles.checkmarkText}>✓</AppText>
              </View>
            )}
          </TouchableOpacity>

          {/* 24-hour format option */}
          <TouchableOpacity
            style={[styles.optionButton, preferences.timeFormat === "24h" && styles.optionButtonActive]}
            onPress={() => handleTimeFormatChange("24h")}
            accessibilityRole="button"
            accessibilityState={{ selected: preferences.timeFormat === "24h" }}
          >
            <View style={styles.optionContent}>
              <AppText
                variant="boldText"
                style={[styles.optionTitle, preferences.timeFormat === "24h" && styles.optionTitleActive]}
              >
                24-Hour Format
              </AppText>
              <AppText
                variant="notes"
                style={[styles.optionDescription, preferences.timeFormat === "24h" && styles.optionDescriptionActive]}
              >
                14:30, 09:00
              </AppText>
            </View>
            {preferences.timeFormat === "24h" && (
              <View style={styles.checkmark}>
                <AppText style={styles.checkmarkText}>✓</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Future settings placeholder */}
      <View style={styles.section}>
        <AppText variant="notes" style={styles.comingSoonText}>
          More accessibility options coming soon...
        </AppText>
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  loadingText: {
    textAlign: "center",
    color: COLORS.lightGray,
  },
  header: {
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
  },
  headerTitle: {
    color: COLORS.black,
  },
  headerSubtitle: {
    color: COLORS.lightGray,
  },
  errorContainer: {
    padding: SPACING.md,
    backgroundColor: "#ffebee",
    borderRadius: SPACING.sm,
  },
  errorText: {
    color: "#c62828",
  },
  section: {
    gap: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.black,
    fontSize: FONT_SIZES.md,
  },
  sectionDescription: {
    color: COLORS.lightGray,
    marginTop: -SPACING.sm,
  },
  optionsContainer: {
    gap: SPACING.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    backgroundColor: COLORS.white2,
    borderRadius: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white2,
  },
  optionButtonActive: {
    backgroundColor: COLORS.primary1 + "10",
    borderColor: COLORS.primary1,
  },
  optionContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  optionTitle: {
    color: COLORS.black,
    fontSize: FONT_SIZES.md,
  },
  optionTitleActive: {
    color: COLORS.primary1,
  },
  optionDescription: {
    color: COLORS.lightGray,
    fontSize: FONT_SIZES.sm,
  },
  optionDescriptionActive: {
    color: COLORS.primary1,
  },
  checkmark: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.md,
  },
  checkmarkText: {
    color: COLORS.colorWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  comingSoonText: {
    textAlign: "center",
    color: COLORS.lightGray,
    fontStyle: "italic",
  },
});
