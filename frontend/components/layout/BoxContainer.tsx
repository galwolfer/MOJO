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

type Props = ScrollViewProps & {
  children?: React.ReactNode;
};

/**
 * BoxContainer - A ScrollView wrapper with predefined container styles.
 * @param children - The content to display inside the scroll view.
 * @param contentContainerStyle - Additional styles for the content container.
 * @param rest - Other ScrollView props.
 */
const BoxContainer: React.FC<Props> = ({ children, contentContainerStyle, ...rest }) => {
  return (
    <ScrollView contentContainerStyle={[boxContainerStyle, contentContainerStyle]} {...rest}>
      {children}
    </ScrollView>
  );
};

export const boxContainerStyle: ViewStyle = {
  padding: SPACING.lg,
  alignItems: "stretch",
  gap: SPACING.lg,
};

export default BoxContainer;
