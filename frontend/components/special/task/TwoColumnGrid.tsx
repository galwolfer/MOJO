import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import { StyleSheet } from "react-native";
import { SPACING } from "../../../theme";

export const TwoColumnGrid: React.FC<{ items: React.ReactNode[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <View style={styles.gridContainer}>
      {visible.map((it, i) => (
        <View key={i} style={styles.gridItem}>
          {typeof it === "string" || typeof it === "number"
            ? (() => {
                console.debug("TwoColumnGrid: primitive item", String(it), new Error().stack);
                return <AppText>{String(it)}</AppText>;
              })()
            : it}
        </View>
      ))}
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
  },
  gridItem: {
    width: "48%",
    marginBottom: SPACING.sm,
  },
});
