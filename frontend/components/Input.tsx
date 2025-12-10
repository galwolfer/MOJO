/**
 * Input
 *
 * A flexible input component with multiple type support (currently text).
 * Styled using the app's theme with consistent spacing, colors, and shadows.
 *
 * Usage:
 *   <Input value={text} onChangeText={setText} placeholder="Enter text..." />
 *   <Input type="text" label="Name" />
 */
import React, { useRef } from "react";
import { View, TextInput, TextInputProps, StyleSheet, Animated, Platform, Text } from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY } from "../theme";
import AppText from "./AppText";

type InputType = "text" | "email" | "password" | "number";

type InputProps = Omit<TextInputProps, "style"> & {
  type?: InputType;
  label?: string;
  error?: string;
};

const Input: React.FC<InputProps> = ({ type = "text", label, error, placeholder, ...rest }) => {
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  // Track the actual value to determine if we should show the custom placeholder
  const providedValue = (rest as any).value ?? (rest as any).defaultValue;
  const isEmpty =
    providedValue === undefined ||
    providedValue === null ||
    (typeof providedValue === "string" && providedValue.length === 0);

  const animateBorder = (hasError: boolean) => {
    Animated.timing(borderColorAnim, {
      toValue: hasError ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const animatedBorderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.primary1, COLORS.primary7],
  });

  React.useEffect(() => {
    animateBorder(!!error);
  }, [error]);

  const getKeyboardType = () => {
    switch (type) {
      case "email":
        return "email-address";
      case "number":
        return "numeric";
      default:
        return "default";
    }
  };

  const getSecureTextEntry = () => {
    return type === "password";
  };

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      )}
      <Animated.View style={[styles.inputWrapper, { borderColor: animatedBorderColor }]}>
        <TextInput
          style={[
            styles.input,
            Platform.OS === "web"
              ? ({ outlineWidth: 0, outlineStyle: "none", outlineColor: "transparent" } as any)
              : undefined,
          ]}
          // On Android, native placeholder doesn't respect custom fonts reliably.
          // Use empty placeholder and overlay custom text instead.
          placeholder={Platform.OS === "android" ? "" : placeholder}
          placeholderTextColor={COLORS.lightGray}
          keyboardType={getKeyboardType()}
          secureTextEntry={getSecureTextEntry()}
          underlineColorAndroid="transparent"
          {...rest}
        />
        {/* Custom placeholder overlay for Android to ensure proper font rendering */}
        {Platform.OS === "android" && isEmpty && placeholder && (
          <Text style={styles.customPlaceholder} pointerEvents="none">
            {placeholder}
          </Text>
        )}
      </Animated.View>
      {error && (
        <AppText variant="notes" style={styles.errorText}>
          {error}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    width: "100%",
    gap: SPACING.sm,
  },
  label: {
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "flex-start",
    gap: SPACING.sm + 2,
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    borderWidth: 0.15,
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.white,
    boxShadow: SHADOWS.card.web,
    minHeight: 44,
    position: "relative" as const,
  },
  input: {
    flex: 1,
    width: "100%",
    padding: SPACING.md,
    // Apply input typography from theme
    fontFamily: TYPOGRAPHY.input.fontFamily,
    fontSize: TYPOGRAPHY.input.fontSize,
    color: TYPOGRAPHY.input.color,
    lineHeight: TYPOGRAPHY.input.lineHeight,
    margin: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    // Android-specific font fixes
    ...(Platform.OS === "android"
      ? {
          fontWeight: "400" as any,
          fontStyle: "normal" as const,
          includeFontPadding: false,
          textAlignVertical: "center" as const,
        }
      : {}),
  },
  customPlaceholder: {
    position: "absolute",
    left: SPACING.md,
    top: SPACING.md,
    fontFamily: FONTS.fredokaLight,
    fontSize: TYPOGRAPHY.input.fontSize,
    color: COLORS.lightGray,
    lineHeight: TYPOGRAPHY.input.lineHeight,
    pointerEvents: "none",
  },
  errorText: {
    color: COLORS.primary7,
  },
});

export default Input;
