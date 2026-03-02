import React from "react";
import { View, useWindowDimensions } from "react-native";
import AppText from "../../common/AppText";
import { StyleSheet } from "react-native";
import { SPACING } from "../../../theme";

const BREAKPOINT_WIDTH = 640;

export const TwoColumnGrid: React.FC<{ items: React.ReactNode[] }> = ({ items }) => {
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= BREAKPOINT_WIDTH;

  if (!items || items.length === 0) return null;
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <View style={styles.gridContainer}>
      {visible.map((it, i) => {
        const itemStyle = isTwoColumn ? [styles.gridItem, styles.gridItemTwoColumn] : styles.gridItem;

        // Clone element and pass horizontal prop if it's a React element
        const content =
          React.isValidElement(it) && !isTwoColumn
            ? React.cloneElement(it as React.ReactElement<any>, { horizontal: true })
            : it;

        return (
          <View key={i} style={itemStyle}>
            {typeof content === "string" || typeof content === "number"
              ? (() => {
                  return <AppText>{String(content)}</AppText>;
                })()
              : content}
          </View>
        );
      })}
    </View>
  );
};

export default TwoColumnGrid;

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    width: "100%",
  },
  gridItem: {
    width: "100%",
    marginBottom: SPACING.sm,
    justifyContent: "center",
    alignItems: "flex-start",
    flexShrink: 1,
  },
  gridItemTwoColumn: {
    width: "48%",
    flexShrink: 1,
  },
});
