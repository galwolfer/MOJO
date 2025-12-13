import React from "react";
import { Modal, Pressable, Animated, View } from "react-native";
import AppText from "../common/AppText";
import { Checkbox } from "../icons/Checkbox";
import { SPACING, DIVIDER, SHADOWS, COLORS } from "../../theme";

interface DropdownModalProps {
  visible: boolean;
  dropdownLayout: { top: number; left: number; width: number };
  dropdownAnim: Animated.Value;
  options: string[];
  multiSelect: boolean;
  selected: string[];
  onToggleOption: (option: string) => void;
  onRequestClose: () => void;
}

/**
 * DropdownModal - A modal component for displaying dropdown options.
 * @param visible - Whether the modal is visible.
 * @param dropdownLayout - Layout information for positioning.
 * @param dropdownAnim - Animation value for the dropdown.
 * @param options - Array of option strings.
 * @param multiSelect - Whether multiple selections are allowed.
 * @param selected - Array of selected options.
 * @param onToggleOption - Callback to toggle an option.
 * @param onRequestClose - Callback to close the modal.
 */
const DropdownModal: React.FC<DropdownModalProps> = ({
  visible,
  dropdownLayout,
  dropdownAnim,
  options,
  multiSelect,
  selected,
  onToggleOption,
  onRequestClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <Pressable style={{ flex: 1, backgroundColor: "transparent" }} onPress={onRequestClose}>
        <Animated.View
          style={{
            position: "absolute",
            top: dropdownLayout.top,
            left: dropdownLayout.left,
            width: dropdownLayout.width,
            opacity: dropdownAnim,
            backgroundColor: COLORS.white,
            borderRadius: 14,
            borderWidth: 0.15,
            borderColor: COLORS.brightP1,
            paddingVertical: SPACING.sm,
            ...(SHADOWS.card as any),
            transform: [
              { translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              { scaleY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
            ],
          }}
        >
          {options.map((option, index) => (
            <React.Fragment key={option}>
              <Pressable
                onPress={() => onToggleOption(option)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  gap: SPACING.sm,
                }}
              >
                {multiSelect && <Checkbox checked={selected.includes(option)} onChange={() => {}} size={18} />}
                <AppText>{option}</AppText>
              </Pressable>
              {index < options.length - 1 && (
                <View style={{ height: DIVIDER.width, backgroundColor: DIVIDER.color, marginHorizontal: SPACING.md }} />
              )}
            </React.Fragment>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default DropdownModal;
