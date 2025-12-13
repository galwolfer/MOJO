import React from "react";
import { Animated, Platform, TextInput, TextInputProps } from "react-native";
import { TYPOGRAPHY, COLORS } from "../../theme";

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
  return (
    <Animated.View style={{ flex: 1 }}>
      <TextInput
        ref={ref}
        style={[{ flex: 1, padding: 12, fontFamily: TYPOGRAPHY.input.fontFamily, fontSize: TYPOGRAPHY.input.fontSize }]}
        placeholder={placeholderText ?? undefined}
        placeholderTextColor={COLORS.lightGray}
        {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
        {...rest}
      />
    </Animated.View>
  );
});

InputField.displayName = "InputField";

export default InputField;
