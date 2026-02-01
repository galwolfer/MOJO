/**
 * Box
 *
 * A simple surfaced container with a styled title bar and content area.
 * - `title` (string) renders a top header using the `title3` typography.
 * - `children` are placed in the content area and will be wrapped by `AppText`
 *   if they're plain strings so body typography applies by default.
 *
 * Use `Box` to group related UI into visually distinct cards.
 */
import React from "react";
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SHADOWS, SPACING, FONT_SIZES } from "../../theme";

type BoxProps = {
  title?: string;
  /**
   * Optional icon to render to the left of the title text. Use a small
   * `React.ReactNode` (e.g., an icon component) so callers can control size/color.
   */
  titleIcon?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * When `widget` is true the box uses a lighter surface (`COLORS.white3`)
   * suitable for embedding as a compact widget. Defaults to `false`.
   */
  widget?: boolean;
  /**
   * Custom background color for the title bar. Defaults to `COLORS.primary1`.
   */
  titleColor?: string;
};

/**
 * Wraps string children with AppText for consistent typography.
 * @param children - The children to wrap.
 * @returns The wrapped children.
 */
const wrapStringChildren = (children?: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, (child) => (typeof child === "string" ? <AppText>{child}</AppText> : child));
};

/**
 * Box - A styled container component with a title bar and content area.
 * @param title - The title to display in the header.
 * @param children - The content to display inside the box.
 */
const Box: React.FC<BoxProps> = ({ title, titleIcon, children, widget = false, style, titleColor }) => {
  const wrappedChildren = wrapStringChildren(children);

  return (
    <View style={[styles.box, widget ? { backgroundColor: COLORS.white3 } : SHADOWS.card]}>
      {title && (
        <View style={[styles.titleWrap, titleColor && { backgroundColor: titleColor }]}>
          {titleIcon ? <View style={styles.titleIcon}>{titleIcon}</View> : null}
          <AppText variant="title3" style={styles.titleText}>
            {title}
          </AppText>
        </View>
      )}
      <View style={[styles.content, style]}>{wrappedChildren}</View>
    </View>
  );
};
const styles = StyleSheet.create({
  box: {
    width: "100%",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    backgroundColor: COLORS.white2,
    overflow: "hidden",
  },
  titleWrap: {
    minHeight: SPACING.xlg + 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    borderTopLeftRadius: SPACING.lg,
    borderTopRightRadius: SPACING.lg,
    backgroundColor: COLORS.primary1,
    flexWrap: "wrap",
    rowGap: SPACING.xs,
    columnGap: SPACING.sm,
  },
  titleIcon: {
    width: FONT_SIZES.md,
    height: FONT_SIZES.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  titleText: {
    color: COLORS.colorWhite,
  },
  content: {
    padding: SPACING.md,
    alignSelf: "stretch",
    overflow: "hidden",
  },
});

export default Box;
