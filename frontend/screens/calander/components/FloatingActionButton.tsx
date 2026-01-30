/**
 * FloatingActionButton Component
 *
 * A floating action button for adding new tasks.
 *
 * Usage:
 * ```tsx
 * <FloatingActionButton onPress={handleAddTask} />
 * ```
 */
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, SHADOWS } from "../../../theme";

interface FloatingActionButtonProps {
  onPress: () => void;
}

export default function FloatingActionButton({ onPress }: FloatingActionButtonProps) {
  return (
    <TouchableOpacity style={styles.floatingButton} activeOpacity={0.8} onPress={onPress}>
      <AppText style={styles.floatingButtonText}>+</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: SPACING.xlg * 4,
    right: SPACING.lg,
    backgroundColor: COLORS.primary6,
    borderRadius: SPACING.xlg * 2,
    width: SPACING.xlg * 2,
    height: SPACING.xlg * 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
    ...(SHADOWS.card as object),
  },
  floatingButtonText: {
    color: COLORS.white,
    textAlign: "center",
  },
});
