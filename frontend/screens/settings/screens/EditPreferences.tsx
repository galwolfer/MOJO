import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import Box from "../../../components/layout/Box";
import List from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import GoalsPrioritiesSettingsScreen from "./GoalsPrioritiesSettings";
import SchedulingSettingsScreen from "./SchedulingSettings";
import SettingsSubScreen from "./components/SettingsSubScreen";

type CurrentScreen = "main" | "priorities" | "scheduling";
type EditPreferencesScreenProps = { onBack: () => void; onSave?: () => void; initialScreen?: CurrentScreen };
export default function EditPreferencesScreen({ onBack, initialScreen }: EditPreferencesScreenProps) {
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>(initialScreen ?? "main");

  if (currentScreen === "priorities") return <GoalsPrioritiesSettingsScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "scheduling") return <SchedulingSettingsScreen       onBack={() => setCurrentScreen("main")} />;

  const GoalsIcon = ICONS.goals;
  const ClockIcon = ICONS.clock;

  const listData = [
    makeListCell("priorities", {
      title: "Priorities", subtitle: "Adjust how important each life category is",
      logo: <GoalsIcon size={ICON_SIZES.sm} color={COLORS.primary7} />,
      onPress: () => setCurrentScreen("priorities"), divider: true,
    }),
    makeListCell("scheduling", {
      title: "Scheduling", subtitle: "Set your busy blocks and task gap preferences",
      logo: <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
      onPress: () => setCurrentScreen("scheduling"), divider: false,
    }),
  ];

  return (
    <SettingsSubScreen title="Edit Preferences" iconName="prefrences" scrollKey="edit-preferences-hub" onBack={onBack}>
      <Box>
        <List data={listData} />
      </Box>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { width: "100%", paddingVertical: SPACING.sm },
});
