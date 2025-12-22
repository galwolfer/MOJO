import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";

export default function CalendarScreen() {
  const { setHeaderConfig } = useNavigation();

  useEffect(() => {
    setHeaderConfig({
      title: "Calendar",
      show: true,
      icon: ICONS.calendar,
    });
  }, []);

  return (
    <View style={styles.container}>
      <AppText variant="bodyText">Calendar / Tasks Screen Placeholder</AppText>
      <AppText variant="notes">Task list and calendar view...</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
  },
});
