/**
 * OjoNotificationBanner
 *
 * An in-app notification banner that slides down from the top of the screen
 * when a push notification with an Ojo personality is received while the app
 * is in the foreground. Displays the Ojo type icon, colored accent, title,
 * and body text. Auto-dismisses after a configurable duration.
 *
 * Usage:
 *   Rendered once in NotificationContext — no manual placement needed.
 *   Call `showOjoNotification({ ojoType, title, body, onTap })` to display.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from "react-native";
import { COLORS, FONTS, FONT_SIZES, SPACING } from "../../theme";
import { ICONS } from "../icons/icons";
import { getOjoType, getOjoTypeColor, type OjoTypeName } from "../../config/ojoTypeConfig";

/** Props for the banner data */
export type OjoNotificationBannerData = {
  ojoType: OjoTypeName;
  title: string;
  body: string;
  onTap?: () => void;
};

type Props = {
  /** The notification data to display, or null to hide */
  data: OjoNotificationBannerData | null;
  /** Auto-dismiss duration in ms (default 5000) */
  duration?: number;
  /** Called when the banner is dismissed (auto or manual) */
  onDismiss?: () => void;
};

const BANNER_HEIGHT = 100;
const ANIM_DURATION = 300;
const STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight || 30 : 50;

/**
 * Animated in-app notification banner with Ojo personality icon.
 */
export function OjoNotificationBanner({ data, duration = 5000, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - STATUS_BAR_HEIGHT)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT - STATUS_BAR_HEIGHT,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  }, [translateY, onDismiss]);

  useEffect(() => {
    if (data) {
      setVisible(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, duration);
    } else {
      dismiss();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data]);

  if (!visible && !data) return null;

  const ojoType = data?.ojoType || "mentorjo";
  const config = getOjoType(ojoType);
  const color = getOjoTypeColor(ojoType);
  const OjoIcon = ICONS[config.icon as keyof typeof ICONS] || ICONS.ojo;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], paddingTop: STATUS_BAR_HEIGHT },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.85}
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          dismiss();
          data?.onTap?.();
        }}
      >
        {/* Ojo icon with colored circle */}
        <View style={[styles.iconCircle, { backgroundColor: color + "20" }]}>
          {OjoIcon && <OjoIcon size={28} color={color} />}
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {data?.title || ""}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {data?.body || ""}
          </Text>
        </View>

        {/* Colored accent bar on the left */}
        <View style={[styles.accentBar, { backgroundColor: color }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.black2,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 16,
    padding: SPACING.md,
    gap: SPACING.md,
    overflow: "hidden",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
  },
  body: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
});
