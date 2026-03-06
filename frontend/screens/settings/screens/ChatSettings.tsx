import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { ICONS } from "../../../components/icons/icons";
import Box from "../../../components/layout/Box";
import List, { type ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import { useOjo } from "../../../context/OjoContext";
import { getOjoType } from "../../../config/ojoTypeConfig";
import OjoTypeSettingsScreen from "./OjoTypeSettings";
import MemoriesSettingsScreen from "./MemoriesSettings";
import SettingsSubScreen from "./components/SettingsSubScreen";

type ChatSettingsScreenProps = { onBack: () => void; onSave?: () => void };
type CurrentScreen = "main" | "ojo-type" | "memories";

export default function ChatSettingsScreen({ onBack }: ChatSettingsScreenProps) {
  const colors = useColors();
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>("main");
  const { ojoName } = useOjo();

  if (currentScreen === "ojo-type") return <OjoTypeSettingsScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "memories")  return <MemoriesSettingsScreen onBack={() => setCurrentScreen("main")} />;

  const ojoCfg         = getOjoType((ojoName as any) ?? "mentorjo");
  const CurrentOjoIcon = ICONS[ojoCfg.icon as keyof typeof ICONS] ?? ICONS.ojo;
  const MemoryIcon     = ICONS.reflection;

  const items: ListCellProps[] = [
    makeListCell("ojo-type", {
      title: "OjoType", subtitle: ojoCfg.displayName,
      logo: <CurrentOjoIcon size={ICON_SIZES.sm} color={ojoCfg.color} />,
      onPress: () => setCurrentScreen("ojo-type"), divider: true,
    }),
    makeListCell("memories", {
      title: "Your Memories", subtitle: "Facts your Ojo remembers about you",
      logo: <MemoryIcon size={ICON_SIZES.sm} color={colors.gray2} />,
      onPress: () => setCurrentScreen("memories"), divider: false,
    }),
  ];

  return (
    <SettingsSubScreen title="Chat Settings" iconName="ojo" scrollKey="chat-settings" onBack={onBack}>
      <Box>
        <View style={styles.listContent}>
          <List data={items} />
        </View>
      </Box>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { width: "100%", paddingVertical: SPACING.sm },
});
