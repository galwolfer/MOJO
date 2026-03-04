/**
 * ChatSettingsScreen
 *
 * Hub screen for chat-related settings.
 * Navigates to OjoType and Memories sub-screens.
 * Mirrors the pattern of AccessibilitySettingsScreen.
 */
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { useNavigation } from "../../../context/NavigationContext";
import { ICONS } from "../../../components/icons/icons";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import Box from "../../../components/layout/Box";
import List, { ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import { useOjo } from "../../../context/OjoContext";
import { getOjoType } from "../../../config/ojoTypeConfig";
import OjoTypeSettingsScreen from "./OjoTypeSettings";
import MemoriesSettingsScreen from "./MemoriesSettings";

type ChatSettingsScreenProps = {
  onBack: () => void;
  onSave?: () => void;
};

type CurrentScreen = "main" | "ojo-type" | "memories";

export default function ChatSettingsScreen({ onBack, onSave }: ChatSettingsScreenProps) {
  const colors = useColors();
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>("main");
  const { setHeaderConfig } = useNavigation();
  const { ojoName } = useOjo();

  const LeftIcon = ICONS.left;
  const OjoIcon = ICONS.ojo;

  useEffect(() => {
    if (currentScreen === "main") {
      setHeaderConfig({
        title: "Chat Settings",
        show: true,
        icon: ICONS.ojo,
        leftElement: (
          <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
            <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
          </TouchableOpacity>
        ),
        rightElement: (
          <View style={styles.headerIcon}>
            <OjoIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
          </View>
        ),
      });
    }
  }, [currentScreen]);

  // Sub-screen routing
  if (currentScreen === "ojo-type") {
    return <OjoTypeSettingsScreen onBack={() => setCurrentScreen("main")} />;
  }

  if (currentScreen === "memories") {
    return <MemoriesSettingsScreen onBack={() => setCurrentScreen("main")} />;
  }

  // Derive current ojo icon + color for the list item
  const ojoCfg = getOjoType((ojoName as any) ?? "mentorjo");
  const CurrentOjoIcon = ICONS[ojoCfg.icon as keyof typeof ICONS] ?? ICONS.ojo;
  const MemoryIcon = ICONS.reflection;

  const settingsItems: ListCellProps[] = [
    makeListCell("ojo-type", {
      title: "OjoType",
      subtitle: ojoCfg.displayName,
      logo: <CurrentOjoIcon size={ICON_SIZES.sm} color={ojoCfg.color} />,
      onPress: () => setCurrentScreen("ojo-type"),
      divider: true,
    }),
    makeListCell("memories", {
      title: "Your Memories",
      subtitle: "Facts your Ojo remembers about you",
      logo: <MemoryIcon size={ICON_SIZES.sm} color={colors.gray2} />,
      onPress: () => setCurrentScreen("memories"),
      divider: false,
    }),
  ];

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="chat-settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      <Box>
        <View style={styles.listContent}>
          <List data={settingsItems} />
        </View>
      </Box>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: SPACING.md,
  },
  headerTouchable: {
    padding: SPACING.xs,
  },
  headerIcon: {
    padding: SPACING.xs,
  },
  listContent: {
    width: "100%",
    paddingVertical: SPACING.sm,
  },
});
