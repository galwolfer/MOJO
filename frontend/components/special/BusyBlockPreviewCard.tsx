/**
 * BusyBlockPreviewCard
 *
 * Read-only display of a single BusyBlock — used in scheduling-conflict popups
 * so the user can see exactly which busy blocks prevented auto-scheduling.
 * Visual design mirrors the BlockRow in BlocksBox.tsx but without edit/delete actions.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { BusyBlock, blockSummary, BLOCK_TYPE_LABEL } from "../../services/busyBlockService";
import { useAccessibilityPreferences } from "../../hooks/useAccessibilityPreferences";

interface BusyBlockPreviewCardProps {
  block: BusyBlock;
}

export default function BusyBlockPreviewCard({ block }: BusyBlockPreviewCardProps) {
  const { preferences } = useAccessibilityPreferences();
  const use12h = preferences.timeFormat === "12h";

  const typeLabel = block.blockType ? BLOCK_TYPE_LABEL[block.blockType] : null;
  const summary = blockSummary(block, use12h);

  return (
    <View style={styles.container}>
      <View style={styles.leftBar} />
      <View style={styles.info}>
        {block.title ? (
          <AppText style={styles.title}>{block.title}</AppText>
        ) : null}
        {typeLabel ? (
          <AppText style={styles.typeLabel}>{typeLabel}</AppText>
        ) : null}
        {summary ? (
          <AppText style={styles.summary} numberOfLines={5}>
            {summary}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  leftBar: {
    width: 4,
    backgroundColor: COLORS.primary5, // amber — signals a conflict
  },
  info: {
    flex: 1,
    gap: 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    color: COLORS.darkGray,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary5,
    textTransform: "uppercase",
  },
  summary: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
});
