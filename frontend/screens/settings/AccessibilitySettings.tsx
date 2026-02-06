/**
 * AccessibilitySettingsScreen
 *
 * Dedicated screen for managing accessibility preferences.
 */

import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import { useNavigation } from "../../context/NavigationContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import AccessibilitySettings from "../../components/special/AccessibilitySettings";

type AccessibilitySettingsScreenProps = {
  onBack: () => void;
};

export default function AccessibilitySettingsScreen({ onBack }: AccessibilitySettingsScreenProps) {
  const { setHeaderConfig } = useNavigation();

  const LeftIcon = ICONS.left;
  const AccessibilityIcon = ICONS.settings;

  useEffect(() => {
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
  }, []);

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="accessibility-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      <AccessibilitySettings />
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
});
