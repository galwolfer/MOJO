/**
 * Input
 *
 * A flexible input component with multiple type support (text, email, password, number, dropdown).
 * Styled using the app's theme with consistent spacing, colors, and shadows.
 *
 * Usage:
 *   <Input value={text} onChangeText={setText} placeholder="Enter text..." />
 *   <Input type="text" label="Name" />
 *   <Input
 *     type="dropdown"
 *     label="Select Option"
 *     options={['Option 1', 'Option 2']}
 *     onSelect={(opt) => console.log(opt)}
 *   />
 */
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  Platform,
  Text,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY } from "../../theme";
import AppText from "../AppText";
import { ICONS } from "../icons/icons";

type InputType = "text" | "email" | "password" | "number" | "dropdown";

interface InputProps<T = any> extends Omit<TextInputProps, "style"> {
  type?: InputType;
  label?: string;
  error?: string;
  // Dropdown specific props
  options?: T[];
  renderOption?: (item: T) => React.ReactNode;
  onSelect?: (item: T) => void;
  filterFunction?: (item: T, query: string) => boolean;
  displayValue?: (item: T) => string;
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

function Input<T = any>({
  type = "text",
  label,
  error,
  placeholder,
  options = [],
  renderOption,
  onSelect,
  filterFunction,
  displayValue,
  ...rest
}: InputProps<T>) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();
  const [isOpen, setIsOpen] = useState(false);

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

  // Dropdown logic
  const filteredOptions = React.useMemo(() => {
    if (type !== "dropdown") return [];
    const text = (typeof providedValue === "string" ? providedValue : "").toLowerCase();

    // If text is empty, show all options
    if (!text) return options;

    return options.filter((item) => {
      if (filterFunction) return filterFunction(item, text);
      const labelStr = displayValue ? displayValue(item) : String(item);
      return labelStr.toLowerCase().includes(text);
    });
  }, [options, providedValue, type, filterFunction, displayValue]);

  const handleSelect = (item: T) => {
    if (onSelect) onSelect(item);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <View style={[styles.container, isOpen ? { zIndex: 9999 } : { zIndex: 1 }]}>
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
          onFocus={(e) => {
            if (type === "dropdown") setIsOpen(true);
            rest.onFocus?.(e);
          }}
          {...rest}
          selectionColor={selectionColor}
          cursorColor={cursorColor}
          {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
        />

        {type === "dropdown" && (
          <TouchableOpacity onPress={toggleDropdown} style={styles.iconButton}>
            {isOpen ? <ICONS.up size={20} color={COLORS.primary1} /> : <ICONS.down size={20} color={COLORS.primary1} />}
          </TouchableOpacity>
        )}

        {/* Custom placeholder overlay for Android to ensure proper font rendering */}
        {Platform.OS === "android" && isEmpty && placeholder && (
          <Text style={styles.customPlaceholder} pointerEvents="none">
            {placeholder}
          </Text>
        )}
      </Animated.View>

      {type === "dropdown" && isOpen && (
        <View style={styles.dropdownList}>
          <FlatList
            data={filteredOptions}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                {renderOption ? (
                  renderOption(item)
                ) : (
                  <AppText>{displayValue ? displayValue(item) : String(item)}</AppText>
                )}
              </TouchableOpacity>
            )}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 200 }}
          />
        </View>
      )}

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
    position: "relative",
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
    position: "relative" as const,
    paddingRight: SPACING.sm,
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
  iconButton: {
    padding: SPACING.sm / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    marginTop: SPACING.sm / 2,
    maxHeight: 200,
    zIndex: 9999,
    elevation: 10,
    boxShadow: SHADOWS.card.web,
  },
  optionItem: {
    padding: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.lightGray,
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
