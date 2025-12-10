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
import React, { useRef, useEffect } from "react";
import { View, TextInput, TextInputProps, StyleSheet, Animated, Platform, Text } from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY } from "../../theme";
import AppText from "../AppText";

type InputType = "text" | "email" | "password" | "number";

type InputProps = Omit<TextInputProps, "style"> & {
  type?: InputType;
  label?: string;
  error?: string;
};

const Input: React.FC<InputProps> = ({ type = "text", label, error, placeholder, ...rest }) => {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  // For web we inject a small stylesheet to reliably control caret and selection colors
  const webIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = `input-${Math.random().toString(36).slice(2, 9)}`;
    webIdRef.current = id;
    const style = document.createElement("style");
    style.id = `style-${id}`;
    // semi-transparent primary for selection background
    const selectionBg = (hex: string, alpha = 0.28) => {
      // convert #RRGGBB to rgba
      const m = hex.replace("#", "");
      const r = parseInt(m.substring(0, 2), 16);
      const g = parseInt(m.substring(2, 4), 16);
      const b = parseInt(m.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    style.textContent = `#${id} { caret-color: ${COLORS.brightP1} !important; }
#${id}::selection { background: ${selectionBg(COLORS.brightP1, 0.28)} !important; }`;
    document.head.appendChild(style);
    return () => {
      const s = document.getElementById(`style-${id}`);
      if (s) s.remove();
    };
  }, []);

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
              ? ({
                  outlineWidth: 5,
                  outlineStyle: "none",
                  outlineColor: "transparent",
                  caretColor: COLORS.primary1,
                } as any)
              : undefined,
          ]}
          // Use empty placeholder and overlay custom text instead.
          placeholder={Platform.OS === "android" ? "" : placeholder}
          placeholderTextColor={COLORS.lightGray}
          keyboardType={getKeyboardType()}
          secureTextEntry={getSecureTextEntry()}
          underlineColorAndroid="transparent"
          {...rest}
          // Android: selectionColor is highlight, cursorColor is cursor.
          // iOS: selectionColor is both.
          selectionColor={COLORS.brightP1}
          cursorColor={COLORS.primary1}
          {...(Platform.OS === "web" && webIdRef.current ? { nativeID: webIdRef.current } : {})}
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
    borderColor: COLORS.brightP1,
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
