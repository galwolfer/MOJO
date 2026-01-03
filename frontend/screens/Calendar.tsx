import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import ScrollableContent from "../components/layout/ScrollableContent";

export default function CalendarScreen() {
  const { setHeaderConfig } = useNavigation();

  const Calendar = (
    <View>
      <AppText variant="bodyText">Calendar Placeholder</AppText>
    </View>
  );

  useEffect(() => {
    setHeaderConfig({
      title: "Calendar",
      show: true,
      icon: ICONS.calendar,
      element: Calendar,
    });
  }, []);

  return (
    <ScrollableContent respectHeader={true} respectNavBar={true} contentContainerStyle={styles.contentContainer}>
      <AppText variant="bodyText">Calendar / Tasks Screen Placeholder</AppText>
      <AppText variant="notes">Task list and calendar view...</AppText>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
  },
});
