/**
 * NotificationBell
 *
 * A small bell icon button with an unread count badge.
 * Tapping it navigates to the NotificationInbox screen.
 *
 * Usage: Drop into any screen's header rightElement.
 */
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, FONTS, FONT_SIZES, SPACING, ICON_SIZES } from "../../theme";
import { useNavigation } from "../../context/NavigationContext";
import { useNotifications } from "../../context/NotificationContext";
import { useColors } from "../../context/ThemeContext";

const isWeb = Platform.OS === "web";
const BADGE_SIZE = isWeb ? 22 : 16;
const BADGE_FONT = isWeb ? 13 : 10;
const BADGE_LINE = isWeb ? 20 : 14;

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
    top: -2,
    right: -4,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: COLORS.primary4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white1,
    fontSize: BADGE_FONT,
    fontFamily: FONTS.fredokaSemiBold,
    lineHeight: BADGE_LINE,
  },
});
