/**
 * Confirmation Widget
 * Displays a generic confirmation prompt with Yes/No or custom buttons
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { SPACING } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { getWidgetEntranceProps } from "./widgetHelpers";

/**
 * ConfirmationWidget - Renders a confirmation dialog
 */
const ConfirmationWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  const colors = useColors();
  const { title, message, confirmText = "Yes", cancelText = "No", confirmColor, cancelColor, icon } = data;

  return (
    <Widget {...getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration }, { skipAnimation: true })}>
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
          <AppText variant="bodyText" style={[styles.message, { color: colors.gray2 }]}>
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
  },
});

export default ConfirmationWidget;
