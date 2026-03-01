/**
 * RadioButton Component
 *
 * A reusable radio button component for selecting one option from a list.
 */

import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { COLORS, SPACING } from "../../theme";
import AppText from "./AppText";
import List, { ListCellProps } from "../layout/List";
import { useColors } from "../../context/ThemeContext";

export type RadioButtonOption = {
  id: string;
  label: string;
  description?: string;
  value: any;
};

type RadioButtonProps = {
  selected: boolean;
  label: string;
  description?: string;
  onPress: () => void;
};

/**
 * RadioButton - Individual radio button option
 */
export function RadioButton({ selected, label, description, onPress }: RadioButtonProps) {
  const colors = useColors();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Radio circle */}
      <View style={[styles.radioCircle, { borderColor: colors.gray1 }, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>

      {/* Label and description */}
      <View style={styles.content}>
        <AppText variant="boldText" style={[styles.label, { color: colors.text1 }]}>
          {label}
        </AppText>
        {description && (
          <AppText variant="notes" style={[styles.description, { color: colors.gray1 }]}>
            {description}
          </AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}

type RadioButtonGroupProps = {
  options: RadioButtonOption[];
  selectedId: string;
  onSelect: (id: string, value: any) => void;
};

/**
 * RadioButtonGroup - A group of radio buttons using List component
 */
export function RadioButtonGroup({ options, selectedId, onSelect }: RadioButtonGroupProps) {
  const listItems: ListCellProps[] = options.map((option, index) => ({
    id: option.id,
    content: (
      <RadioButton
        selected={selectedId === option.id}
        label={option.label}
        description={option.description}
        onPress={() => onSelect(option.id, option.value)}
      />
    ),
    onPress: () => onSelect(option.id, option.value),
    divider: index < options.length - 1,
  }));

  return <List data={listItems} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },

  // Radio circle
  radioCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  radioCircleSelected: {
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.primary1 + "10",
  },

  radioDot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: COLORS.primary1,
  },

  // Content
  content: {
    flex: 1,
  },

  label: {
    color: COLORS.black,
    marginBottom: SPACING.xs,
  },

  description: {
    color: COLORS.lightGray,
  },
});
