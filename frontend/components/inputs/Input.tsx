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
  FlatList,
  Modal,
  Keyboard, // Import Keyboard
  TouchableOpacity,
} from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY } from "../../theme";
import AppText from "../AppText";
import { ICONS } from "../icons/icons";

type InputType = "text" | "email" | "password" | "number" | "dropdown";

interface InputProps<T = any> extends Omit<TextInputProps, "style"> {
  type?: InputType;
  label?: string;
  error?: string;
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
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();

  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const isClosingRef = useRef(false);

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

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

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

  const filteredOptions = React.useMemo(() => {
    if (type !== "dropdown") return [];
    const text = (typeof providedValue === "string" ? providedValue : "").toLowerCase();
    if (!text) return options;

    return options.filter((item) => {
      if (filterFunction) return filterFunction(item, text);
      const labelStr = displayValue ? displayValue(item) : String(item);
      return labelStr.toLowerCase().includes(text);
    });
  }, [options, providedValue, type, filterFunction, displayValue]);

  // Updated Close Handler
  const closeDropdown = () => {
    isClosingRef.current = true;
    setIsOpen(false);
    // Blur the input to hide the keyboard and remove focus state
    inputRef.current?.blur();
    // Manually dismiss the keyboard on native platforms for instant closing
    if (Platform.OS !== "web") {
      Keyboard.dismiss();
    }
    setTimeout(() => {
      isClosingRef.current = false;
    }, 100);
  };

  const handleSelect = (item: T) => {
    if (onSelect) onSelect(item);
    const textValue = displayValue ? displayValue(item) : String(item);
    if (rest.onChangeText) rest.onChangeText(textValue);

    closeDropdown(); // Use the unified close function
  };

  const openDropdown = () => {
    // Only open if the input type is dropdown
    if (type !== "dropdown") return;

    // Measure where the input is on the entire screen (Page X/Y)
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      // Calculate position just below the input box
      setDropdownCoords({ x, y: y + height, width, height });
      setIsOpen(true);
      // Explicitly focus the input to enable typing/filtering
      inputRef.current?.focus();
    });
  };

  // Use openDropdown or closeDropdown based on current state
  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      // Clear the text when opening the dropdown via the icon
      if (rest.onChangeText) rest.onChangeText("");
      openDropdown();
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      )}

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
            // If the input receives focus, open the dropdown, unless it's already open or closing
            if (type === "dropdown" && !isOpen && !isClosingRef.current) openDropdown();
            rest.onFocus?.(e);
          }}
          // If using the Modal/Pressable solution, we typically don't need onBlur here
          // as we rely on the overlay tap to close everything.
          // If you need specific onBlur logic, be careful with timing.
          {...rest}
          selectionColor={selectionColor}
          cursorColor={cursorColor}
          {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
        />

        {type === "dropdown" && (
          // Use Pressable instead of TouchableOpacity for better responsiveness
          <Pressable onPress={toggleDropdown} style={styles.iconButton}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <ICONS.down width={20} height={20} color={COLORS.primary1} />
            </Animated.View>
          </Pressable>
        )}

        {Platform.OS === "android" && isEmpty && placeholder && (
          <Text style={styles.customPlaceholder} pointerEvents="none">
            {placeholder}
          </Text>
        )}
      </Animated.View>

      {/* Render Dropdown in a Transparent Modal */}
      {type === "dropdown" && isOpen && (
        <Modal
          visible={isOpen}
          transparent
          animationType="none"
          // Use the unified close function here
          onRequestClose={closeDropdown}
        >
          {/* Pressable overlay to close when clicking outside */}
          <Pressable
            style={styles.modalOverlay}
            // Important: This stops the press event from propagating to children (the dropdown list itself)
            onPress={closeDropdown}
          >
            {/* The Dropdown List container */}
            <View
              // This TouchableWithoutFeedback prevents the internal list press from closing the modal
              style={[
                styles.dropdownList,
                {
                  top: dropdownCoords.y + (Platform.OS === "android" ? 0 : 2),
                  left: dropdownCoords.x,
                  width: dropdownCoords.width,
                },
              ]}
              // Prevent the overlay press event from triggering when pressing on the list
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <FlatList
                data={filteredOptions}
                keyExtractor={(_, index) => index.toString()}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                    {renderOption ? (
                      renderOption(item)
                    ) : (
                      <AppText>{displayValue ? displayValue(item) : String(item)}</AppText>
                    )}
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 200 }}
              />

              {filteredOptions.length === 0 && (
                <View style={styles.noOptions}>
                  <AppText variant="notes" style={{ color: COLORS.darkGray }}>
                    No results found
                  </AppText>
                </View>
              )}
            </View>
          </Pressable>
        </Modal>
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
  iconButton: {
    padding: SPACING.sm / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dropdownList: {
    position: "absolute",
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden", // Ensures rounded corners are respected
  },
  optionItem: {
    padding: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.lightGray,
  },
  noOptions: {
    padding: SPACING.md,
    alignItems: "center",
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
