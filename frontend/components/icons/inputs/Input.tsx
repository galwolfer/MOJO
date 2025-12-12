import React, { useRef, useEffect, useState } from "react";
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  Platform,
  Text,
  Modal,
  Easing,
  // Changed to Pressable for better handling of simultaneous gestures
  Pressable,
} from "react-native";
import { COLORS, SPACING, SHADOWS, FONTS, TYPOGRAPHY, DIVIDER } from "../../../theme";
import AppText from "../../AppText";
import { Checkbox } from "../Checkbox";
import { Chevron } from "../Chevron";

type InputType = "text" | "email" | "password" | "number";

interface InputProps<T = any> extends Omit<TextInputProps, "style"> {
  type?: InputType;
  label?: string;
  error?: string;
  // Optional props for dropdown functionality
  options?: string[];
  onSelect?: (values: string[]) => void;
  multiSelect?: boolean;
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
  options,
  onSelect,
  multiSelect = false,
  ...rest
}: InputProps<T>) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();

  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ top: 0, left: 0, width: 0 });
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const closeDropdown = () => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      if (multiSelect) onSelect?.(selected);
    });
  };
  const providedValue = (rest as any).value ?? (rest as any).defaultValue;
  const hasSelected = selected.length > 0;
  const isEmpty =
    !hasSelected &&
    (providedValue === undefined ||
      providedValue === null ||
      (typeof providedValue === "string" && providedValue.length === 0));

  // Sync selected with provided value for options
  useEffect(() => {
    if (options && typeof providedValue === "string") {
      const vals = providedValue
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      setSelected(vals);
    }
  }, [providedValue, options]);

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
          if (options) {
            if (isOpen) {
              // close with animation
              closeDropdown();
            } else {
              // measure and open
              wrapperRef.current?.measure((x, y, width, height, pageX, pageY) => {
                // subtract a small spacing so the dropdown visually sits flush with the input
                // On mobile use half the input height so the dropdown sits closer to the input center
                const topOffset = Platform.OS === "web" ? pageY + height + SPACING.sm : pageY + height / 2;
                setDropdownLayout({ top: topOffset, left: pageX, width });
                setIsOpen(true);
                // start open animation shortly after setIsOpen so Modal is visible
                requestAnimationFrame(() => {
                  Animated.timing(dropdownAnim, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
                    useNativeDriver: true,
                  }).start();
                });
              });
            }
            inputRef.current?.focus();
          }
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
            placeholder={
              Platform.OS === "android" ? "" : options ? (selected.length === 0 ? placeholder : "") : placeholder
            }
            placeholderTextColor={COLORS.lightGray}
            keyboardType={getKeyboardType()}
            secureTextEntry={getSecureTextEntry()}
            editable={!options}
            value={options ? (multiSelect ? "" : selected.join("x ")) : (rest as any).value}
            onFocus={(e) => {
              rest.onFocus?.(e);
            }}
            onChangeText={(text) => {
              if (!options) {
                rest.onChangeText?.(text);
              }
            }}
            {...rest}
            selectionColor={selectionColor}
            cursorColor={cursorColor}
            {...(Platform.OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
          />

          {options && (
            <View style={{ marginRight: 8 }}>
              <Chevron isOpen={isOpen} size={TYPOGRAPHY.input.lineHeight ?? TYPOGRAPHY.input.fontSize} />
            </View>
          )}

          {Platform.OS === "android" && isEmpty && placeholder && (
            <Text style={styles.customPlaceholder} pointerEvents="none">
              {placeholder}
            </Text>
          )}
        </Animated.View>
      </Pressable>

      {options && (
        <Modal
          visible={isOpen}
          transparent={true}
          animationType="none"
          onRequestClose={() => {
            // use closeAnimation
            closeDropdown();
          }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              closeDropdown();
            }}
          >
            <Animated.View
              style={[
                styles.dropdown,
                {
                  top: dropdownLayout.top,
                  left: dropdownLayout.left,
                  width: dropdownLayout.width,
                  opacity: dropdownAnim,
                  transform: [
                    {
                      translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                    },
                    {
                      scaleY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
                    },
                  ],
                },
              ]}
            >
              {options.map((option, index) => (
                <React.Fragment key={option}>
                  <Pressable
                    onPress={() => {
                      if (!multiSelect) {
                        const newSelected = [option];
                        setSelected(newSelected);
                        // animate close then call onSelect
                        Animated.timing(dropdownAnim, {
                          toValue: 0,
                          duration: 220,
                          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
                          useNativeDriver: true,
                        }).start(() => {
                          setIsOpen(false);
                          onSelect?.(newSelected);
                        });
                      } else {
                        const newSelected = selected.includes(option)
                          ? selected.filter((s) => s !== option)
                          : [...selected, option];
                        setSelected(newSelected);
                        onSelect?.(newSelected);
                      }
                    }}
                    style={styles.option}
                  >
                    {multiSelect && <Checkbox checked={selected.includes(option)} onChange={() => {}} size={18} />}
                    <AppText>{option}</AppText>
                  </Pressable>
                  {index < options.length - 1 && <View style={styles.optionDivider} />}
                </React.Fragment>
              ))}
            </Animated.View>
          </Pressable>
        </Modal>
      )}

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dropdown: {
    position: "absolute",
    backgroundColor: COLORS.white,
    borderRadius: SPACING.lg,
    borderWidth: 0.15,
    borderColor: COLORS.brightP1,
    boxShadow: SHADOWS.card.web,
    ...(Platform.OS !== "web" ? SHADOWS.card.rn : {}),
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  optionDivider: {
    height: DIVIDER.width,
    backgroundColor: DIVIDER.color,
    marginHorizontal: SPACING.md,
  },
});

export default Input;
