/**
 * Confirmation Widget
 * Displays a generic confirmation prompt with Yes/No or custom buttons
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

/**
 * ConfirmationWidget - Renders a confirmation dialog
 */
const ConfirmationWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const { title, message, confirmText = "Yes", cancelText = "No", confirmColor, cancelColor, icon } = data;

  const handleConfirm = () => {
    onAction?.("confirmed", { confirmed: true });
  };

  const handleCancel = () => {
    onAction?.("cancelled", { confirmed: false });
  };

  const getButtonColor = (colorName?: string, defaultColor = COLORS.primary1) => {
    if (!colorName) return defaultColor;
    switch (colorName.toLowerCase()) {
      case "green":
      case "success":
        return COLORS.primary6;
      case "red":
      case "danger":
      case "error":
        return COLORS.primary7;
      case "orange":
      case "warning":
        return COLORS.primary5;
      case "blue":
      case "primary":
      default:
        return COLORS.primary1;
    }
  };

  return (
    <Widget skipAnimation>
      <View style={styles.container}>
        {/* Icon and Title */}
        <View style={styles.header}>
          {icon && <AppText style={styles.icon}>{icon}</AppText>}
          {title && (
            <AppText variant="title3" style={styles.title}>
              {title}
            </AppText>
          )}
        </View>

        {/* Message */}
        {message && (
          <AppText variant="bodyText" style={styles.message}>
            {message}
          </AppText>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <AppButton
            title={cancelText}
            mode="light"
            color={getButtonColor(cancelColor, COLORS.darkGray)}
            onPress={handleCancel}
            style={styles.button}
          />
          <AppButton
            title={confirmText}
            mode="filled"
            color={getButtonColor(confirmColor, COLORS.primary6)}
            onPress={handleConfirm}
            style={styles.button}
          />
        </View>
      </View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    lineHeight: 22,
    color: COLORS.darkGray,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.md,
    width: "100%",
  },
  button: {
    flex: 1,
  },
});

export default ConfirmationWidget;
