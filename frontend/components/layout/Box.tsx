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
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from "../../theme";

type BoxProps = {
  title: string;
  children?: React.ReactNode;
};

const Box: React.FC<BoxProps> = ({ title, children }) => {
  const wrappedChildren = React.Children.map(children, (child) =>
    typeof child === "string" ? <AppText>{child}</AppText> : child
  );

  return (
    <View style={styles.box}>
      <View style={styles.titleWrap}>
        <AppText variant="title3" style={styles.titleText}>
          {title}
        </AppText>
      </View>
      <View style={styles.content}>{wrappedChildren}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    backgroundColor: COLORS.white2,
    overflow: "visible",
    boxShadow: SHADOWS.card.web,
  },
  titleWrap: {
    height: SPACING.xlg + 5,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "column",
    alignItems: "center",
    alignSelf: "stretch",
    borderTopLeftRadius: SPACING.lg,
    borderTopRightRadius: SPACING.lg,
    backgroundColor: COLORS.primary1,
  },
  titleText: {
    color: COLORS.colorWhite,
  },
  content: {
    padding: SPACING.md,
    alignSelf: "stretch",
    overflow: "visible",
  },
});

export default Box;
