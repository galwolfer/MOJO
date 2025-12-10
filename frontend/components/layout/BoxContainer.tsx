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
