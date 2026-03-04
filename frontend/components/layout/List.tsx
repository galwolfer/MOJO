/**
 * List Component
 * A reusable list component with cells that can contain multiple sections
 */

import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, DIVIDER, COMPONENT_STYLES } from "../../theme";
import { useColors } from "../../context/ThemeContext";

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
  dividerColor?: string;
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
  const colors = useColors();
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
          {content
            ? (() => {
                if (typeof content === "string" || typeof content === "number") {
                  // Debug - capture origin when a primitive is used as the `content` prop
                  console.debug("ListCell: primitive content", String(content), new Error().stack);
                  return (
                    <View style={styles.contentContainer}>
                      <AppText>{String(content)}</AppText>
                    </View>
                  );
                }

                return <View style={styles.contentContainer}>{content}</View>;
              })()
            : partsToRender.map((part) => (
                <View key={part.id} style={[styles.part, { flex: part.flex ?? 1 }, part.style]}>
                  {typeof part.content === "string" || typeof part.content === "number"
                    ? // Wrap primitive content in Text to avoid react-native-web View text-node errors
                      (console.debug("ListCell: primitive part.content", String(part.content), new Error().stack),
                      (<AppText>{String(part.content)}</AppText>))
                    : part.content}
                </View>
              ))}
        </View>
      </TouchableOpacity>
      {divider && <View style={[styles.dividerLine, { backgroundColor: dividerColor ?? colors.divider }]} />}
    </View>
  );
};

/**
 * List - A simple columnar list that renders rows
 */
const List: React.FC<ListProps> = ({ data, renderCell, gap = SPACING.sm, style, dividerColor, keyExtractor }) => {
  const defaultRenderCell = (cell: ListCellProps, index: number, uniqueKey: string) => (
    <ListCell
      key={uniqueKey}
      id={uniqueKey}
      parts={cell.parts}
      content={cell.content}
      onPress={cell.onPress}
      disabled={cell.disabled}
      style={cell.style}
      divider={cell.divider !== false && index !== data.length - 1}
      dividerColor={cell.dividerColor ?? dividerColor}
    />
  );

  return (
    <View style={[styles.container, style]}>
      {data.map((cell, index) => {
        const baseKey = keyExtractor ? keyExtractor(cell) : cell.id;
        const uniqueKey = `${baseKey}-${index}`;
        return (
          <View key={uniqueKey} style={styles.cellWrapper}>
            {renderCell ? renderCell(cell) : defaultRenderCell(cell, index, uniqueKey)}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  cellWrapper: {
    alignSelf: "stretch",
    width: "100%",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignSelf: "stretch",
    width: "100%",
  },
  row: {
    alignSelf: "stretch",
    width: "100%",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "stretch",
    width: "100%",
  },
  touchable: {
    alignSelf: "stretch",
    width: "100%",
  },
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.white,
    marginVertical: SPACING.xs,
    alignSelf: "stretch",
    width: "100%",
  },
  contentContainer: {
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "stretch",
    flex: 1,
    width: "100%",
  },
  disabled: {
    opacity: 0.6,
  },
  part: {
    justifyContent: "center",
  },
});

export default List;
