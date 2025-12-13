import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { COLORS, SHADOWS, SPACING } from "../theme";
import ConicGradientBubble from "./ConicGradientBubble";

type Props = {
  style?: ViewStyle;
  children?: React.ReactNode;
};

const TextBouble: React.FC<Props> = ({ style, children }) => {
  return (
    <View style={[styles.wrapper, style]}>
      <ConicGradientBubble style={{ ...styles.conic, filter: "blur(10px)" }} />
      <View style={styles.container}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "stretch",
  },
  container: {
    flexDirection: "column",
    height: "auto", // 14.625rem ≈ 234px
    padding: 17, // 1.0625rem ≈ 17px
    alignItems: "flex-start",
    gap: 17,
    alignSelf: "stretch",
    borderTopLeftRadius: SPACING.sm,
    borderTopRightRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    borderBottomLeftRadius: SPACING.xlg,
    backgroundColor: COLORS.white2,

    // Blue outline shadow (approximation for React Native)
    shadowColor: COLORS.primary1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,

    elevation: 3,
  },
  conic: {
    position: "absolute",
    top: -18,
    left: -18,
    right: -18,
    bottom: -18,
    borderTopLeftRadius: SPACING.sm,
    borderTopRightRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    borderBottomLeftRadius: SPACING.xlg,
    zIndex: Platform.OS === "web" ? 0 : undefined,
  },
});

export default TextBouble;
