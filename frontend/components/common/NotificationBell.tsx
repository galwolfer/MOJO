/**
 * NotificationBell
 *
 * A small bell icon button with an unread count badge.
 * Tapping it navigates to the NotificationInbox screen.
 *
 * Usage: Drop into any screen's header rightElement.
 */
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, FONTS, FONT_SIZES, SPACING, ICON_SIZES } from "../../theme";
import { useNavigation } from "../../context/NavigationContext";
import { useNotifications } from "../../context/NotificationContext";
import { useColors } from "../../context/ThemeContext";

export default function NotificationBell() {
  const { setActiveTab } = useNavigation();
  const { unreadCount } = useNotifications();
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={() => setActiveTab("notifications")}
      activeOpacity={0.7}
      style={styles.button}
    >
      <ICONS.notifications size={ICON_SIZES.md} color={colors.primary1} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "relative",
    padding: SPACING.xs,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white1,
    fontSize: 10,
    fontFamily: FONTS.fredokaSemiBold,
    lineHeight: 14,
  },
});
