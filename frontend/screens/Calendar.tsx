import React, { useEffect } from "react";

/**
 * CalendarScreen
 *
 * Placeholder calendar screen — integrates with `NavigationContext` to set header content.
 */
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import ScrollableContent from "../components/layout/ScrollableContent";
import useContentInsets from "../hooks/useContentInsets";

export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab } = useNavigation();

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

  const insets = useContentInsets();

  const handleAddTask = () => {
    setActiveTab("create");
  };

  return (
    <>
      <ScrollableContent
        respectHeader={true}
        respectNavBar={true}
        extraTopPadding={SPACING.lg}
        scrollKey="calendar"
        contentContainerStyle={styles.contentContainer}
      >
        <AppText variant="bodyText">Calendar / Tasks Screen Placeholder</AppText>
        <AppText variant="notes">Task list and calendar view...</AppText>
      </ScrollableContent>

      {/* Floating ADD TASK Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          { bottom: Math.max(100, insets.bottom + SPACING.lg) },
        ]}
        activeOpacity={0.8}
        onPress={handleAddTask}
      >
        <AppText variant="bodyText" style={styles.buttonText}>
          ADD TASK
        </AppText>
        <ICONS.plus size={20} color={COLORS.white} style={styles.plusIcon} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: SPACING.lg,
    backgroundColor: COLORS.primary1,
    borderRadius: 50,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "600",
    marginRight: SPACING.sm,
  },
  plusIcon: {
    marginLeft: SPACING.sm,
  },
});
