/**
 * BoxContainer
 *
 * A small layout wrapper that provides the shared `boxContainer` spacing
 * and alignment used across the theme showcase. Exported as both a
 * `boxContainerStyle` object and a `BoxContainer` ScrollView wrapper.
 */
import React from "react";
import { ScrollView, ScrollViewProps, ViewStyle } from "react-native";
import { SPACING } from "../../theme";

export const boxContainerStyle: ViewStyle = {
  padding: SPACING.md,
  alignItems: "stretch",
  gap: SPACING.lg,
};

type Props = ScrollViewProps & {
  children?: React.ReactNode;
};

const BoxContainer: React.FC<Props> = ({ children, contentContainerStyle, ...rest }) => {
  return (
    <ScrollView contentContainerStyle={[boxContainerStyle, contentContainerStyle]} {...rest}>
      {children}
    </ScrollView>
  );
};

export default BoxContainer;
