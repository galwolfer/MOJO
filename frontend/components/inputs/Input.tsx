import React, { useRef, useEffect, useState } from "react";
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  Platform,
  Text,
  // Changed to Pressable for better handling of simultaneous gestures
  Pressable,
} from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY } from "../../theme";
import AppText from "../AppText";

type InputType = "text" | "email" | "password" | "number";

interface InputProps<T = any> extends Omit<TextInputProps, "style"> {
  type?: InputType;
  label?: string;
  error?: string;
  // Optional props kept for compatibility with the earlier dropdown UX (currently unused)
  options?: string[];
  onSelect?: (value: string) => void;
}

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

function Input<T = any>({ type = "text", label, error, placeholder, options, onSelect, ...rest }: InputProps<T>) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();

  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  const providedValue = (rest as any).value ?? (rest as any).defaultValue;
  const isEmpty =
    providedValue === undefined ||
    providedValue === null ||
    (typeof providedValue === "string" && providedValue.length === 0);

  // ... (animateBorder, animatedBorderColor, rotate, useEffects for rotation and border) ...
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

  // dropdown-related rotation removed

  React.useEffect(() => {
    animateBorder(!!error);
  }, [error]);
  // ... (end of animations) ...

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

  const getSecureTextEntry = () => type === "password";
  const selectionColor = Platform.OS === "android" ? hexToRgba(COLORS.primary1, 0.28) : COLORS.primary1;
  const cursorColor = COLORS.primary1;

  // No dropdown filtering - plain text input now

  // No dropdown helper functions anymore

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      )}

      <Pressable
        onPress={() => {
          // focus the input when pressing the wrapper
          inputRef.current?.focus();
        }}
        style={styles.inputWrapperPressable}
      >
        <Animated.View
          ref={wrapperRef}
          collapsable={false}
          style={[styles.inputWrapper, { borderColor: animatedBorderColor }]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : undefined]}
            placeholder={Platform.OS === "android" ? "" : placeholder}
            placeholderTextColor={COLORS.lightGray}
            keyboardType={getKeyboardType()}
            secureTextEntry={getSecureTextEntry()}
            onFocus={(e) => {
              rest.onFocus?.(e);
            }}
            onChangeText={(text) => {
              rest.onChangeText?.(text);
            }}
            // If using the Modal/Pressable solution, we typically don't need onBlur here
            // as we rely on the overlay tap to close everything.
            // If you need specific onBlur logic, be careful with timing.
            {...rest}
            selectionColor={selectionColor}
            cursorColor={cursorColor}
            {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
          />

          {Platform.OS === "android" && isEmpty && placeholder && (
            <Text style={styles.customPlaceholder} pointerEvents="none">
              {placeholder}
            </Text>
          )}
        </Animated.View>
      </Pressable>
      {/* dropdown removed - use external picker component if needed */}

      {error && (
        <AppText variant="notes" style={styles.errorText}>
          {error}
        </AppText>
      )}
    </View>
  );
}

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
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    gap: SPACING.sm + 2,
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    borderWidth: 0.15,
    borderColor: COLORS.brightP1,
    backgroundColor: COLORS.white,
    boxShadow: SHADOWS.card.web,
    minHeight: 44,
    paddingRight: SPACING.sm,
  },
  // Transparent pressable wrapper that covers the input area (no visible styling)
  inputWrapperPressable: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    backgroundColor: "transparent",
    paddingRight: SPACING.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    width: "100%",
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.input.fontFamily,
    fontSize: TYPOGRAPHY.input.fontSize,
    color: TYPOGRAPHY.input.color,
    lineHeight: TYPOGRAPHY.input.lineHeight,
    backgroundColor: "transparent",
    borderWidth: 0,
    ...(Platform.OS === "android" ? { includeFontPadding: false, textAlignVertical: "center" } : {}),
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
