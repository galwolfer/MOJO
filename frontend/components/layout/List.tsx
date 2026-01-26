/**
 * List Component
 * A reusable list component with cells that can contain multiple sections
 */

import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { COLORS, SPACING, DIVIDER, COMPONENT_STYLES } from "../../theme";

export interface ListCellPart {
  id: string;
  content: ReactNode;
  flex?: number;
  style?: ViewStyle;
}

export interface ListCellProps {
  id: string;
  // Either provide `parts` (detailed) OR provide a single `content` box with arbitrary components.
  // `content` is the simplest way to compose rows visually.
  content?: ReactNode;
  parts?: ListCellPart[];
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  // horizontal divider between rows
  divider?: boolean;
  dividerColor?: string;
}

export interface ListProps {
  data: ListCellProps[];
  renderCell?: (cell: ListCellProps) => ReactNode;
  gap?: number;
  style?: ViewStyle;
  keyExtractor?: (item: ListCellProps) => string;
}

/**
 * ListCell - A compact row with optional horizontal divider between rows
 */
import { TouchableOpacity } from "react-native";

export const ListCell: React.FC<ListCellProps> = ({
  id,
  parts,
  content,
  onPress,
  disabled = false,
  style,
  divider = true,
  dividerColor,
}) => {
  const partsToRender: ListCellPart[] = parts && parts.length > 0 ? parts : [];

  return (
    <View style={[styles.row, disabled && styles.disabled, style] as any}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled || !onPress}
        style={styles.touchable}
        accessibilityRole={onPress ? "button" : undefined}
      >
        <View style={styles.rowInner}>
          {content ? (
            <View style={styles.contentContainer}>{content}</View>
          ) : (
            partsToRender.map((part) => (
              <View key={part.id} style={[styles.part, { flex: part.flex ?? 1 }, part.style]}>
                {part.content}
              </View>
            ))
          )}
        </View>
      </TouchableOpacity>
      {divider && <View style={[styles.dividerLine, { backgroundColor: dividerColor ?? COLORS.white3 }]} />}
    </View>
  );
};

/**
 * List - A simple columnar list that renders rows
 */
const List: React.FC<ListProps> = ({ data, renderCell, gap = SPACING.sm, style, keyExtractor }) => {
  const defaultRenderCell = (cell: ListCellProps, index: number) => (
    <ListCell
      key={cell.id}
      id={cell.id}
      parts={cell.parts}
      content={cell.content}
      onPress={cell.onPress}
      disabled={cell.disabled}
      style={cell.style}
      divider={cell.divider !== false && index !== data.length - 1}
      dividerColor={cell.dividerColor}
    />
  );

  return (
    <View style={[styles.container, style]}>
      {data.map((cell, index) => (
        <View key={keyExtractor ? keyExtractor(cell) : cell.id}>
          {renderCell ? renderCell(cell) : defaultRenderCell(cell, index)}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm / 2,
  },
  row: {
    width: "100%",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
  },
  touchable: {
    alignSelf: "stretch",
  },
  dividerLine: {
    width: "100%",
    height: SPACING.sm / 2,
    backgroundColor: COLORS.white,
    borderRadius: 1,
    marginTop: SPACING.sm / 2,
    alignSelf: "stretch",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  disabled: {
    opacity: 0.6,
  },
  part: {
    justifyContent: "center",
  },
});

export default List;
