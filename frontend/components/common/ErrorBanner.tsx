/**
 * ErrorBanner
 *
 * Displays a list of form validation errors using the `errorText` typography variant.
 * Renders nothing when there are no errors.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING } from "../../theme";
import AppText from "./AppText";

interface Props {
  errors: string[];
}

const ErrorBanner: React.FC<Props> = ({ errors }) => {
  if (!errors || errors.length === 0) return null;

  return (
    <View style={styles.container}>
      {errors.map((error, index) => (
        <AppText key={index} variant="errorText" style={styles.errorItem}>
          • {error}
        </AppText>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  errorItem: {
    marginBottom: SPACING.xs,
  },
});

export default ErrorBanner;
