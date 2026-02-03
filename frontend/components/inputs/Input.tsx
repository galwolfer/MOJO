import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  View,
  ViewStyle,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  Platform,
  Modal,
  Easing,
  // Changed to Pressable for better handling of simultaneous gestures
  Pressable,
} from "react-native";
import {
  COLORS,
  SPACING,
  SHADOWS,
  FONTS,
  TYPOGRAPHY,
  DIVIDER,
  ICON_SIZES,
  IconSizeKey,
  COMPONENT_STYLES,
  FONT_SIZES,
} from "../../theme";
import AppText from "../common/AppText";
import { Checkbox } from "../icons/Checkbox";
import { Chevron } from "../icons/Chevron";

type InputType = "text" | "email" | "password" | "number" | "longtext";

type InputOption =
  | string
  | {
      label: string;
      value: string;
      icon?: React.ComponentType<{ size?: number; color?: string }>;
      iconColor?: string;
      iconBackground?: string;
    };

interface InputProps<T = any> extends Omit<TextInputProps, "style"> {
  type?: InputType;
  label?: string;
  error?: string;
  enterToSubmit?: boolean;
  // Optional props for dropdown functionality
  options?: InputOption[];
  onSelect?: (values: string[]) => void;
  multiSelect?: boolean;
  // optional icon size control (sm | md | big)
  iconSize?: IconSizeKey;
}

/**
 * Converts a hex color to rgba format.
 * @param hex - The hex color string.
 * @param alpha - The alpha value (0-1).
 * @returns The rgba color string.
 */
const hexToRgba = (hex: string, alpha = 1) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Custom hook for web-specific caret and selection styling.
 * @param idPrefix - Prefix for the unique ID.
 * @returns The unique ID for the input.
 */
function useWebCaret(idPrefix = "input") {
  const idRef = useRef<string | null>(null);
  useEffect(() => {
    if ((Platform as any).OS !== "web") return;
    const id = `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`;
    idRef.current = id;
    const style = document.createElement("style");
    style.id = `style-${id}`;
    const selectionColor = hexToRgba(COLORS.primary1, 0.28);
    // Localized rules for this input plus broader rules so web text inputs
    // and textareas use the light placeholder font. We keep the ID-specific
    // rules to control caret and selection for this input only.
    style.textContent =
      `#${id} { caret-color: ${COLORS.primary1} !important; } ` +
      `#${id}::selection { background: ${selectionColor} !important; } ` +
      `#${id}::placeholder { font-family: '${FONTS.fredokaLight}' !important; font-weight: 300 !important; color: ${COLORS.lightGray} !important; } ` +
      `input::placeholder, textarea::placeholder { font-family: '${FONTS.fredokaLight}' !important; font-weight: 300 !important; color: ${COLORS.lightGray} !important; }`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(`style-${id}`);
      if (el) el.remove();
    };
  }, [idPrefix]);
  return idRef.current;
}

/**
 * Input - A flexible input component with optional dropdown functionality.
 *
 * Note: dropdown `options` are supported for convenience but are considered
 * a lightweight fallback — for complex/accessible selects prefer using a
 * dedicated picker component.
 *
 * @param type - The input type (text, email, password, number).
 * @param label - Optional label for the input.
 * @param error - Optional error message.
 * @param placeholder - Placeholder text.
 * @param options - Array of options for dropdown.
 * @param onSelect - Callback for selection.
 * @param multiSelect - Whether multiple selections are allowed.
 * @param iconSize - Size of icons.
 * @param rest - Other TextInput props.
 */
function Input<T = any>({
  type = "text",
  label,
  error,
  placeholder,
  enterToSubmit = false,
  options,
  onSelect,
  multiSelect = false,
  iconSize = "md",
  ...rest
}: InputProps<T>) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const webNativeID = useWebCaret();
  const {
    onChangeText: onChangeTextProp,
    onFocus: onFocusProp,
    onSubmitEditing: onSubmitEditingProp,
    value: valueProp,
    defaultValue: defaultValueProp,
    ...restInputProps
  } = rest as TextInputProps;
  const hasValueProp = Object.prototype.hasOwnProperty.call(rest, "value");

  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ top: 0, left: 0, width: 0 });
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const normalizedOptions = useMemo(() => {
    if (!options) return undefined;
    return options.map((option) =>
      typeof option === "string"
        ? { label: option, value: option }
        : option,
    );
  }, [options]);

  const optionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (normalizedOptions || []).forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [normalizedOptions]);

  const selectedLabels = useMemo(() => {
    if (!options) return selected;
    return selected.map((value) => optionLabelMap.get(value) ?? value);
  }, [options, selected, optionLabelMap]);

  const closeDropdown = () => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    }).start(() => {
      setIsOpen(false);
      if (multiSelect) onSelect?.(selected);
    });
  };

  const scrollInputIntoView = () => {
    if ((Platform as any).OS !== "web") return;
    if (typeof document === "undefined") return;
    setTimeout(() => {
      const element =
        (webNativeID && document.getElementById(webNativeID)) || (document.activeElement as HTMLElement | null);
      if (element && "scrollIntoView" in element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 50);
  };
  const providedValue = hasValueProp ? valueProp : defaultValueProp;

  const [inputValue, setInputValue] = useState<string>(
    !hasValueProp && typeof providedValue === "string" ? providedValue : "",
  );

  useEffect(() => {
    if (!hasValueProp && providedValue !== undefined && providedValue !== null) {
      setInputValue(String(providedValue));
    }
  }, [providedValue, hasValueProp]);

  // Compute display value and effective placeholder for the TextInput.
  // When using multiSelect and there are no selected items, we want the
  // input to *look* like a placeholder (gray text). To do this we leave the
  // TextInput value empty and set the placeholder to the desired text
  // (explicit `value` or `defaultValue` or the passed `placeholder`).
  const explicitValue = hasValueProp ? valueProp : undefined;
  const defaultValue = defaultValueProp as string | undefined;
  let displayValue: string | undefined = explicitValue as any;
  let effectivePlaceholder: string | undefined = placeholder as any;

  const nonEmpty = (s: string | undefined) => (typeof s === "string" && s.length > 0 ? s : undefined);

  if (options) {
    if (multiSelect) {
      if (selectedLabels.length === 0) {
        displayValue = ""; // show placeholder-style text
        // prefer explicitly provided non-empty value; fall back to placeholder
        effectivePlaceholder = nonEmpty(explicitValue) ?? nonEmpty(defaultValue) ?? placeholder;
      } else {
        displayValue = selectedLabels.join(", ");
        effectivePlaceholder = placeholder;
      }
    } else {
      displayValue = selectedLabels.join(", ");
      effectivePlaceholder = placeholder;
    }
  } else {
    if (hasValueProp) {
      displayValue =
        typeof explicitValue === "string" ? explicitValue : explicitValue == null ? "" : String(explicitValue);
    } else {
      displayValue = nonEmpty(defaultValue) ?? inputValue ?? "";
    }
    effectivePlaceholder = placeholder;
  }

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

  // Removed local iconSizeMap, using ICON_SIZES from theme
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
  const isMultiline = Boolean(restInputProps.multiline ?? type === "longtext");
  const handleKeyPress = (event: any) => {
    if (!enterToSubmit || (Platform as any).OS !== "web") {
      restInputProps.onKeyPress?.(event);
      return;
    }
    const key = event?.nativeEvent?.key;
    const shiftKey = event?.nativeEvent?.shiftKey;
    if (key === "Enter" && !shiftKey) {
      event.preventDefault?.();
      onSubmitEditingProp?.(event);
      return;
    }
    restInputProps.onKeyPress?.(event);
  };

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
          // Always focus the input when the wrapper is tapped to improve tap responsiveness
          inputRef.current?.focus();

          if (options) {
            if (isOpen) {
              // close with animation
              closeDropdown();
            } else {
              // measure and open
              wrapperRef.current?.measure((x, y, width, height, pageX, pageY) => {
                // subtract a small spacing so the dropdown visually sits flush with the input
                // On mobile use half the input height so the dropdown sits closer to the input center
                const topOffset = (Platform as any).OS === "web" ? pageY + height + SPACING.sm : pageY + height / 2;
                setDropdownLayout({ top: topOffset, left: pageX, width });
                setIsOpen(true);
                // start open animation shortly after setIsOpen so Modal is visible
                requestAnimationFrame(() => {
                  Animated.timing(dropdownAnim, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
                    useNativeDriver: false,
                  }).start();
                });
              });
            }
          }
        }}
        style={styles.inputWrapperPressable}
        // Expand touchable area slightly so taps near the border are recognized
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View
          ref={wrapperRef}
          collapsable={false}
          style={[styles.inputWrapper, { borderColor: animatedBorderColor }]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              type === "longtext" ? styles.textarea : undefined,
              (Platform as any).OS === "web" ? ({ outlineWidth: 0 } as any) : undefined,
            ]}
            // Use the native placeholder on all platforms so tapping it focuses the input reliably
            placeholder={effectivePlaceholder}
            placeholderTextColor={COLORS.lightGray}
            keyboardType={getKeyboardType()}
            secureTextEntry={getSecureTextEntry()}
            editable={!options}
            multiline={isMultiline}
            numberOfLines={type === "longtext" ? 5 : undefined}
            blurOnSubmit={enterToSubmit && isMultiline}
            returnKeyType={enterToSubmit ? "send" : restInputProps.returnKeyType}
            value={displayValue}
            onFocus={(e) => {
              onFocusProp?.(e);
              scrollInputIntoView();
            }}
            onChangeText={(text) => {
              if (!hasValueProp) {
                setInputValue(text);
              }
              if (!options) {
                onChangeTextProp?.(text);
              }
            }}
            onSubmitEditing={onSubmitEditingProp}
            onKeyPress={handleKeyPress}
            {...restInputProps}
            selectionColor={selectionColor}
            cursorColor={cursorColor}
            {...((Platform as any).OS === "web" && webNativeID ? { nativeID: webNativeID } : {})}
          />

          {options && (
            <View style={{ marginRight: 8 }}>
              <Chevron isOpen={isOpen} size={TYPOGRAPHY.input.lineHeight ?? TYPOGRAPHY.input.fontSize} />
            </View>
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
              {(normalizedOptions || []).map((option, index) => {
                const optionValue = option.value;
                const optionLabel = option.label;
                const optionIcon = option.icon;
                const optionIconColor = option.iconColor || COLORS.white;
                const optionIconBackground = option.iconBackground || COLORS.white2;
                const isSelected = selected.includes(optionValue);
                return (
                <React.Fragment key={optionValue}>
                  <Pressable
                    onPress={() => {
                      if (!multiSelect) {
                        const newSelected = [optionValue];
                        // update selection state immediately so UI updates
                        setSelected(newSelected);
                        // call onSelect immediately to be responsive
                        onSelect?.(newSelected);
                        // start closing animation but don't wait for it to complete
                        Animated.timing(dropdownAnim, {
                          toValue: 0,
                          duration: 180,
                          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
                          useNativeDriver: false,
                        }).start(() => {
                          setIsOpen(false);
                        });
                      } else {
                        const newSelected = selected.includes(optionValue)
                          ? selected.filter((s) => s !== optionValue)
                          : [...selected, optionValue];
                        setSelected(newSelected);
                        onSelect?.(newSelected);
                      }
                    }}
                    style={styles.option}
                  >
                    <View style={styles.optionContent}>
                      {optionIcon && (
                        <View style={[styles.optionIcon, { backgroundColor: optionIconBackground }]}>
                          {React.createElement(optionIcon, {
                            size: ICON_SIZES[iconSize],
                            color: optionIconColor,
                          })}
                        </View>
                      )}
                      <AppText style={{ flex: 1 }}>{optionLabel}</AppText>
                    </View>
                    {multiSelect && (
                      <Checkbox checked={isSelected} onChange={() => {}} size={ICON_SIZES[iconSize]} />
                    )}
                  </Pressable>
                  {index < (normalizedOptions || []).length - 1 && <View style={styles.optionDivider} />}
                </React.Fragment>
              )})}
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
    width: "auto",
    gap: SPACING.sm,
  },
  label: {
    marginBottom: -SPACING.sm,
    marginTop: SPACING.sm,
  },

  inputWrapper: {
    ...(COMPONENT_STYLES.inputWrapper as ViewStyle),
    // Layout children horizontally and center them vertically so icons line up
    flexDirection: "row",
    alignItems: "center",
  },
  // Transparent pressable wrapper that covers the input area (no visible styling)
  inputWrapperPressable: {
    ...(COMPONENT_STYLES.inputWrapperPressable as ViewStyle),
    // Center the inner input container vertically for consistent icon alignment
    justifyContent: "center",
    // Improve tap target: add some vertical padding and a minimum height
    paddingVertical: SPACING.md,
    minHeight: FONT_SIZES.base * 3.5,
  },
  input: {
    flex: 1,
    width: "100%",
    padding: SPACING.md,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    fontFamily: TYPOGRAPHY.input.fontFamily,
    fontSize: TYPOGRAPHY.input.fontSize,
    color: TYPOGRAPHY.input.color,
    lineHeight: TYPOGRAPHY.input.lineHeight,
    backgroundColor: "transparent",
    borderWidth: 0,
    ...(Platform.OS === "android" ? { includeFontPadding: false, textAlignVertical: "center" } : {}),
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
    ...(SHADOWS.card as any),
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDivider: {
    height: DIVIDER.width,
    backgroundColor: DIVIDER.color,
    marginHorizontal: SPACING.md,
  },
  textarea: {
    minHeight: FONT_SIZES.base * 5,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    textAlignVertical: "top",
  },
});

export default Input;
