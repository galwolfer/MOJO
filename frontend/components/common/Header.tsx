import React, { useState } from "react";
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle, useWindowDimensions, Modal, Pressable } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, ICON_SIZES, COMPONENT_STYLES, FONT_SIZES } from "../../theme";
import GlassSurface from "./GlassSurface";
import { moderateScale } from 'react-native-size-matters';

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

  if (!show) return null;

  const titleFontSize = (() => {
    // Conservative baseline sizes
    const baseSmall = FONT_SIZES.sm ?? 14;
    const baseMed = FONT_SIZES.md ?? 16;
    const baseLarge = FONT_SIZES.lg ?? 18;

    let base = width <= 320 ? baseSmall : width <= 380 ? baseMed : baseLarge;

    // scale down a bit more on small screens
    const scaleFactor = width <= 380 ? 0.55 : width <= 520 ? 0.65 : 0.8;
    let size = moderateScale(base, scaleFactor);

    // If the title is long, reduce further to help it fit
    if (title && title.length > 12) {
      size = Math.max((size * 0.78), baseSmall);
    }

    // Absolute cap so initials don't become huge
    const absoluteCap = baseLarge;
    return Math.min(size, absoluteCap);
  })();
  // Only force a line-break when the title is exactly two words (e.g. "Edit Preferences").
  // Single-word titles should stay single-line to avoid mid-word wrapping like "SETTI\nNGS".
  const words = title ? title.trim().split(/\s+/) : [];
  const isTwoWord = words.length === 2;
  const displayTitle = isTwoWord ? words.join("\n") : title;
  const titleLines = isTwoWord ? 2 : 1;

  const shouldCollapseRight = !!rightElement && (width < 420 || (title && title.length > 14 && width < 520));

  return (
    <View style={[styles.wrapper, style]}>
      <GlassSurface intensity={50} style={[styles.blurSurface, COMPONENT_STYLES.glassSurface]}>
        <View style={styles.container}>
          {/* Left Section (arrow/icon + title) */}
          <View style={styles.leftSection}>
            {leftElement}
            {Icon && !leftElement && <Icon size={ICON_SIZES.big} color={COLORS.primary1} />}
            {title && (
              <Text
                numberOfLines={titleLines}
                ellipsizeMode="tail"
                style={[TYPOGRAPHY.title, styles.titleText, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.15) }]}
              >
                {displayTitle}
              </Text>
            )}
          </View>

          {/* Right Section (fixed) */}
          <View style={styles.rightSection}>
            {shouldCollapseRight ? (
              <Pressable
                accessibilityLabel="Open actions"
                onPress={() => setOverflowOpen(true)}
                style={styles.overflowButton}
              >
                <Text style={styles.overflowText}>⋯</Text>
              </Pressable>
            ) : (
              rightElement
            )}
          </View>
        </View>
        {element && <View>{element}</View>}
      </GlassSurface>

      {/* Overflow modal for collapsed rightElement */}
      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
      >
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
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    flexShrink: 1,
    gap: SPACING.md,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    minWidth: moderateScale(56),
    paddingRight: SPACING.lg,
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
    backgroundColor: (COLORS as any).surface || "#fff",
    padding: SPACING.lg,
    borderRadius: SPACING.md,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginLeft: SPACING.sm,
    maxWidth: "50%",
    color: COLORS.primary1,
  },
});
