import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import Icon from "../../icons/Icon";
import { StyleSheet } from "react-native";
import { SPACING, COLORS, ICON_SIZES } from "../../../theme";

export const FieldRow: React.FC<{
  icon?: string;
  label: string;
  value?: any;
  formatter?: (v: any, task?: any) => React.ReactNode;
  children?: React.ReactNode;
  horizontal?: boolean;
}> = ({ icon, label, value, formatter, children, horizontal = false }) => (
  <View style={horizontal ? styles.fieldHorizontal : styles.field}>
    <View style={styles.labelRow}>
      {icon ? <Icon name={icon} size={ICON_SIZES.sm} color={COLORS.lightGray} style={styles.labelIcon} /> : null}
      <AppText variant="notes" style={styles.labelText}>
        {label}:
      </AppText>
    </View>
    <AppText variant="bodyText" style={horizontal ? styles.valueHorizontal : undefined}>
      {formatter ? formatter(value) : (children ?? (value !== undefined && value !== null ? String(value) : "-"))}
    </AppText>
  </View>
);

export default FieldRow;

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    width: "100%",
  },
  fieldHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: SPACING.md,
    width: "100%",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  labelText: {
    color: COLORS.lightGray,
  },
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
});
