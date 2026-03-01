import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "./AppText";
import { COLORS, SPACING } from "../../theme";

interface Props {
  errors: string[];
}

const ErrorBanner: React.FC<Props> = ({ errors }) => {
  if (!errors || errors.length === 0) return null;
  return (
    <View style={styles.container}>
      {errors.map((e, idx) => (
        <AppText key={idx} style={styles.text}>
          {e}
        </AppText>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary7,
    padding: SPACING.md,
  },
  text: {
    color: COLORS.white1,
  },
});

export default ErrorBanner;
