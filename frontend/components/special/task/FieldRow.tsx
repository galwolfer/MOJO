import React from "react";
import { View, useWindowDimensions } from "react-native";
import AppText from "../../common/AppText";
import Icon from "../../icons/Icon";
import { StyleSheet } from "react-native";
import { SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";

const BREAKPOINT_WIDTH = 640;

export const FieldRow: React.FC<{
  icon?: string;
  label: string;
  value?: any;
  formatter?: (v: any, task?: any) => React.ReactNode;
  children?: React.ReactNode;
  horizontal?: boolean;
}> = ({ icon, label, value, formatter, children, horizontal = false }) => {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= BREAKPOINT_WIDTH;
  const isLabelInline = width < BREAKPOINT_WIDTH;

  let containerStyle;
  let valueStyle;

  if (horizontal && isTwoColumn) {
    // Horizontal two-column layout (wide screens)
    containerStyle = styles.fieldHorizontal;
    valueStyle = styles.valueHorizontal;
  } else if (isLabelInline) {
    // For narrow-to-medium screens, label and value inline but full-width per item
    containerStyle = styles.fieldInline;
    valueStyle = styles.valueInline;
  } else {
    // Default vertical layout (label on top, value below)
    containerStyle = styles.field;
    valueStyle = undefined;
  }

  return (
    <View style={containerStyle}>
      <View style={styles.labelRow}>
        {icon ? <Icon name={icon} size={ICON_SIZES.sm} color={colors.gray1} style={styles.labelIcon} /> : null}
        <AppText variant="notes" style={[styles.labelText, { color: colors.gray1 }]}>
          {label}:
        </AppText>
      </View>
      <AppText variant="bodyText" style={valueStyle}>
        {formatter ? formatter(value) : (children ?? (value !== undefined && value !== null ? String(value) : "-"))}
      </AppText>
    </View>
  );
};

export default FieldRow;

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    width: "100%",
  },
  // On wide screens show as two-column items; on narrow screens each will render as full-width
  fieldHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: SPACING.md,
    width: "48%",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  // Inline layout for label + value on same row (full-width item)
  fieldInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    width: "100%",
    gap: SPACING.md,
  },

  labelText: {},

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexShrink: 0,
  },
  labelIcon: {
    marginRight: SPACING.xs,
  },
  valueHorizontal: {
    textAlign: "right",
    flexShrink: 1,
    flexGrow: 1,
  },
  valueInline: {
    textAlign: "right",
    flexShrink: 1,
    flexGrow: 1,
    marginLeft: SPACING.sm,
  },
});
