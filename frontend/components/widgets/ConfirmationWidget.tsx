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

  return (
    <Widget skipAnimation>
      <View style={styles.container}>
        {/* Icon and Title */}
        <View style={styles.header}>
          {icon && <AppText>{icon}</AppText>}
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
  title: {
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    lineHeight: SPACING.xlg,
    color: COLORS.darkGray,
  },
});

export default ConfirmationWidget;
