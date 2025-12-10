import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "./AppText";
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from "../theme";

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
    overflow: "hidden",
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
  },
});

export default Box;
