import React from "react";

/**
 * SessionDivider
 *
 * Small centered label used to separate chat sessions in the timeline.
 */
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";

interface SessionDividerProps {
  label: string;
}

export default function SessionDivider({ label }: SessionDividerProps) {
  const colors = useColors();
  return (
    <View style={styles.sessionDivider}>
      <AppText variant="notes" style={[styles.sessionDividerText, { color: colors.gray1 }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionDivider: {
    alignSelf: "center",
    paddingVertical: SPACING.sm,
  },
  sessionDividerText: {
    color: COLORS.lightGray,
    textAlign: "center",
  },
});
