import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
  Modal,
  Pressable,
} from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, ICON_SIZES, COMPONENT_STYLES, FONT_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import GlassSurface from "./GlassSurface";
import { moderateScale } from "react-native-size-matters";
import AppText from "./AppText";

/**
 * HeaderProps
 * - `Icon` should be a component that accepts `{ size, color }` props (standard for icon components)
 * - `leftElement`, `rightElement`, `centerElement` and `element` allow injecting custom nodes
 */
type HeaderProps = {
  title?: string;
  Icon?: React.ComponentType<{ size?: number; color?: string }>; // icon component
  show?: boolean;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  centerElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  element?: React.ReactNode;
};

/**
 * Header
 *
 * Reusable app header. Use `leftElement` or `Icon` to show a leading control and
 * `rightElement` for actions. Optional `element` renders an extra row under the main header.
 */
export default function Header({ title, Icon, show = true, rightElement, leftElement, element, style }: HeaderProps) {
  const { width } = useWindowDimensions();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const colors = useColors();

  if (!show) return null;

  const titleFontSize = (() => {
    // Conservative baseline sizes
    const baseSmall = FONT_SIZES.sm ?? 14;
    const baseMed = FONT_SIZES.md ?? 16;
    const baseLarge = FONT_SIZES.lg ?? 18;

    let base = width <= 320 ? baseSmall : width <= 380 ? baseMed : baseLarge;

    // Aggressively reduce scale so titles fit on small devices
    const scaleFactor = width <= 380 ? 0.44 : width <= 520 ? 0.54 : 0.66;
    let size = moderateScale(base, scaleFactor);

    // If the title is long, reduce further to help it fit
    if (title && title.length > 10) {
      size = Math.max(size * 0.6, baseSmall);
    }

    // Lower cap so initials/titles don't appear too large
    const absoluteCap = baseMed;
    return Math.min(size, absoluteCap);
  })();
  // Allow wrapping for long titles or on narrow screens to avoid truncation.
  const words = title ? title.trim().split(/\s+/) : [];
  const allowWrap = title ? title.length > 8 || width < 420 : false;
  const displayTitle = title;
  const titleLines = allowWrap ? 2 : 1;

  return (
    <View style={[styles.wrapper, style]}>
      <GlassSurface intensity={60} style={styles.blurSurface}>
        <View style={styles.container}>
          {/* Left Section (arrow/icon + title) */}
          <View style={styles.leftSection}>
            {leftElement}
            {Icon && !leftElement && <Icon size={ICON_SIZES.big} color={COLORS.primary1} />}
            {title && (
              <AppText
                variant="title3"
                numberOfLines={titleLines}
                ellipsizeMode="tail"
                style={[{ color: colors.primary1, width: "100%" }]}
              >
                {displayTitle}
              </AppText>
            )}
          </View>

          {/* Right Section (fixed) */}
          <View style={styles.rightSection}>{rightElement}</View>
        </View>
        {element && <View>{element}</View>}
      </GlassSurface>

      {/* Overflow modal for collapsed rightElement */}
      <Modal visible={overflowOpen} transparent animationType="fade" onRequestClose={() => setOverflowOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOverflowOpen(false)}>
          <View style={styles.modalContent}>{rightElement}</View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    ...(SHADOWS.card as object),
  },
  blurSurface: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === "android" ? SPACING.xlg + SPACING.md : SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    overflow: "hidden",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: SPACING.sm,
    flexShrink: 1,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },

  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    minWidth: moderateScale(56),
    zIndex: 999,
  },
  overflowButton: {
    padding: SPACING.sm,
    borderRadius: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    minWidth: 200,
    maxWidth: "90%",
    backgroundColor: COLORS.white1,
    padding: SPACING.lg,
    borderRadius: SPACING.md,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginLeft: SPACING.sm,
    maxWidth: "80%",
    color: COLORS.primary1,
  },
});
