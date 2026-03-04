import React from "react";
import { Animated, Platform, TextInput, TextInputProps, StyleSheet } from "react-native";
import { TYPOGRAPHY, COLORS } from "../../theme";
import { useColors } from "../../context/ThemeContext";

interface InputFieldProps extends TextInputProps {
  webNativeID?: string | null;
  placeholderText?: string | null;
}

/**
 * InputField - A custom TextInput component with optional web-specific ID and placeholder.
 * @param webNativeID - Native ID for web.
 * @param placeholderText - Placeholder text.
 * @param rest - Other TextInput props.
 */
const InputField = React.forwardRef<TextInput, InputFieldProps>(({ webNativeID, placeholderText, ...rest }, ref) => {
  const colors = useColors();

  return (
    <Animated.View style={styles.container}>
      <TextInput
        ref={ref}
        style={[styles.input, { color: colors.text1 }]}
        placeholder={placeholderText ?? undefined}
        placeholderTextColor={colors.gray1}
        {...((Platform as any).OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
        {...rest}
      />
    </Animated.View>
  );
});

InputField.displayName = "InputField";

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: { flex: 1, padding: 12, fontFamily: TYPOGRAPHY.input.fontFamily, fontSize: TYPOGRAPHY.input.fontSize },
});

export default InputField;
