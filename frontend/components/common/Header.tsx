import React from "react";
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, ICON_SIZES, COMPONENT_STYLES } from "../../theme";
import GlassSurface from "./GlassSurface";

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
  if (!show) return null;

  return (
    <View style={[styles.wrapper, style]}>
      <GlassSurface intensity={50} style={[styles.blurSurface, COMPONENT_STYLES.glassSurface]}>
        <View style={styles.container}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            {leftElement}
            {Icon && !leftElement && <Icon size={ICON_SIZES.big} color={COLORS.primary1} />}
            {title && (
              <Text numberOfLines={1} ellipsizeMode="tail" style={[TYPOGRAPHY.title, styles.titleText]}>
                {title}
              </Text>
            )}
          </View>

          {/* Right Section */}
          {rightElement && <View style={styles.rightSection}>{rightElement}</View>}
        </View>
        {element && <View>{element}</View>}
      </GlassSurface>
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
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
  },

  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  titleText: {
    flexShrink: 1,
    marginLeft: SPACING.sm,
    color: COLORS.primary1,
  },
});
