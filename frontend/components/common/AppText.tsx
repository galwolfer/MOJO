/**
 * AppText
 *
 * A small wrapper around React Native's `Text` that applies the
 * application's typography presets from `theme.TYPOGRAPHY` and
 * dynamically adapts text colors based on the current theme mode.
 *
 * Usage:
 *   <AppText>Default body text</AppText>
 *   <AppText variant="title2">Section heading</AppText>
 *
 * Keep this component as the single entry point for text styles so
 * typography changes are centralized.
 */
import React from "react";
import { Text, TextProps, TextStyle, StyleProp } from "react-native";
import { TYPOGRAPHY, getThemeColors } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

type Variant = keyof typeof TYPOGRAPHY;

type AppTextProps = TextProps & {
  variant?: Variant;
  children?: React.ReactNode;
};

/**
 * AppText — wraps React Native `Text` and applies the app's
 * typography presets with dynamic theme-aware text colors.
 * Default `variant` is `bodyText`.
 */
const AppText = React.forwardRef<Text, AppTextProps>(({ variant = "bodyText", style, children, ...rest }, ref) => {
  const variantStyle: TextStyle = (TYPOGRAPHY[variant] || TYPOGRAPHY.bodyText) as TextStyle;

  // Get theme colors (safely with fallback)
  let themeColors;
  try {
    const { theme } = useTheme();
    themeColors = getThemeColors(theme);
  } catch {
    // If ThemeContext is not available, use default light theme
    themeColors = getThemeColors("light");
  }

  // Apply theme-aware text color unless explicitly overridden in style
  const textColor = (style as TextStyle)?.color || variantStyle.color || themeColors.text1;

  return (
    <Text ref={ref} style={[variantStyle, { color: textColor }, style]} {...rest}>
      {children}
    </Text>
  );
});

export default AppText;
