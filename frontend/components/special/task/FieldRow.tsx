import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import Icon from "../../icons/Icon";
import { StyleSheet } from "react-native";
import { SPACING, COLORS } from "../../../theme";

export const FieldRow: React.FC<{
  icon?: string;
  label: string;
  value?: any;
  formatter?: (v: any, task?: any) => React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, label, value, formatter, children }) => (
  <View style={styles.field}>
    <View style={styles.labelRow}>
      {icon ? <Icon name={icon} size={16} color={"#999"} style={styles.labelIcon} /> : null}
      <AppText variant="notes" style={styles.labelText}>
        {label}
      </AppText>
    </View>
    <AppText variant="bodyText">
      {formatter ? formatter(value) : (children ?? (value !== undefined && value !== null ? String(value) : "-"))}
    </AppText>
  </View>
);

export default FieldRow;

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  labelText: {
    color: COLORS.lightGray,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  labelIcon: {
    marginRight: SPACING.xs,
  },
});
