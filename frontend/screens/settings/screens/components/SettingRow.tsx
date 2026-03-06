import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../../theme";
import { useColors } from "../../../../context/ThemeContext";
import { Checkbox } from "../../../../components/icons/Checkbox";
import AppText from "../../../../components/common/AppText";

export type SettingRowProps = {
  label: string;
  description?: string;
  Icon?: React.FC<{ size?: number; color?: string }>;
  iconColor?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  nested?: boolean;
  divider?: boolean;
};

/**
 * SettingRow
 *
 * Reusable toggle row for settings screens. Displays an icon, label, description,
 * and a Checkbox. Used across all settings (Notifications, Preferences, etc.).
 */
export default function SettingRow({
  label,
  description,
  Icon,
  iconColor = COLORS.primary1,
  value,
  onChange,
  disabled,
  nested,
  divider = true,
}: SettingRowProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.settingRow,
        { borderBottomColor: colors.bg3 },
        nested && styles.nestedSetting,
        !divider && { borderBottomWidth: 0 },
      ]}
    >
      {Icon && <Icon size={ICON_SIZES.sm} color={iconColor} />}
      <View style={styles.settingInfo}>
        <AppText variant="boldText" style={{ color: colors.text1 }}>
          {label}
        </AppText>
        {description && (
          <AppText variant="notes" style={{ color: colors.gray1 }}>
            {description}
          </AppText>
        )}
      </View>
      <View style={disabled ? { opacity: 0.4 } : undefined}>
        <Checkbox checked={value} onChange={disabled ? undefined : onChange} size={ICON_SIZES.sm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  nestedSetting: {
    marginLeft: SPACING.md,
  },
  settingInfo: { flex: 1 },
});
