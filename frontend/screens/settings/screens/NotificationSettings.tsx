/**
 * NotificationSettingsScreen
 *
 * Dedicated screen for managing push notification preferences.
 */

import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useNavigation } from "../../../context/NavigationContext";
import { ICONS } from "../../../components/icons/icons";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import NotificationSettings from "../../../components/special/NotificationSettings";

type NotificationSettingsScreenProps = {
  onBack: () => void;
};

export default function NotificationSettingsScreen({ onBack }: NotificationSettingsScreenProps) {
  const { setHeaderConfig } = useNavigation();

  const LeftIcon = ICONS.left;
  const NotificationIcon = ICONS.notifications;

  useEffect(() => {
    setHeaderConfig({
      title: "Notifications",
      show: true,
      icon: ICONS.notifications,
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerIcon}>
          <NotificationIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="notification-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      <NotificationSettings />
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
