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

const hexToRgba = (hex: string, alpha = 1) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function useWebCaret(idPrefix = "input") {
  const idRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`;
    idRef.current = id;
    const style = document.createElement("style");
    style.id = `style-${id}`;
    const selectionColor = hexToRgba(COLORS.primary1, 0.28);
    style.textContent = `#${id} { caret-color: ${COLORS.primary1} !important; } #${id}::selection { background: ${selectionColor} !important; }`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(`style-${id}`);
      if (el) el.remove();
    };
  }, [idPrefix]);
  return idRef.current;
}

const Input: React.FC<InputProps> = ({ type = "text", label, error, placeholder, ...rest }) => {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();

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

  // Compute selection / cursor colors once
  const selectionColor = Platform.OS === "android" ? hexToRgba(COLORS.primary1, 0.28) : COLORS.primary1;
  const cursorColor = COLORS.primary1;

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
                  outlineWidth: 0,
                  outlineStyle: "none",
                  outlineColor: "transparent",
                  caretColor: COLORS.primary1,
                } as any)
              : undefined,
          ]}
          // Use empty placeholder and overlay custom text on Android to control font for placeholder
          placeholder={Platform.OS === "android" ? "" : placeholder}
          placeholderTextColor={COLORS.lightGray}
          keyboardType={getKeyboardType()}
          secureTextEntry={getSecureTextEntry()}
          underlineColorAndroid="transparent"
          {...rest}
          selectionColor={selectionColor}
          cursorColor={cursorColor}
          {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
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
