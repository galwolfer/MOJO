/**
 * AppText
 *
 * A small wrapper around React Native's `Text` that applies the
 * application's typography presets from `theme.TYPOGRAPHY`.
 *
 * Usage:
 *   <AppText>Default body text</AppText>
 *   <AppText variant="title2">Section heading</AppText>
 *
 * Keep this component as the single entry point for text styles so
 * typography changes are centralized.
 */
import React from "react";
import { Text, TextProps } from "react-native";
import { TYPOGRAPHY } from "../../theme";

type Variant = keyof typeof TYPOGRAPHY;

type AppTextProps = TextProps & {
  variant?: Variant;
  children?: React.ReactNode;
};

/**
 * AppText — wraps React Native `Text` and applies the app's
 * typography presets. Default `variant` is `bodyText`.
 */
const AppText = React.forwardRef<Text, AppTextProps>(({ variant = "bodyText", style, children, ...rest }, ref) => {
  const variantStyle = (TYPOGRAPHY[variant] || TYPOGRAPHY.bodyText) as any;

  return (
    <Text ref={ref} style={[variantStyle, style]} {...rest}>
      {children}
    </Text>
  );
});

export default AppText;
