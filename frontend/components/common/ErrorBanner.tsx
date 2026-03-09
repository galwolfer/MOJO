import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "./AppText";
import { SPACING } from "../../theme";

interface ErrorBannerProps {
  message: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message }) => {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <AppText style={styles.text}>{message}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#fde8e8",
    borderColor: "#e53e3e",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  text: {
    color: "#c53030",
    fontSize: 13,
  },
});

export default ErrorBanner;
