/**
 * OjoNotificationPersonalitySettings
 *
 * Sub-screen for choosing the Ojo personality used in notification reminders.
 * Options:
 *   • Off — no Ojo personality, standard templated text
 *   • Auto — ML auto-selects the best Ojo per task
 *   • Same as Chat Ojo — mirrors the user's chat OjoType selection
 *   • Specific Ojo types — Mentorjo, Brojo, Bestojo, StrictOjo
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { useColors } from "../../../context/ThemeContext";
import { useOjo } from "../../../context/OjoContext";
import { useNotificationSettings } from "../../../context/NotificationSettingsContext";
import { OjoType } from "../../../services/notificationService";
import { getOjoType, OjoTypeName } from "../../../config/ojoTypeConfig";
import AppText from "../../../components/common/AppText";
import Box from "../../../components/layout/Box";
import { RadioButtonGroup, type RadioButtonOption } from "../../../components/common/RadioButton";
import SettingsSubScreen from "./components/SettingsSubScreen";

type Props = { onBack: () => void };

const OJO_TYPES: OjoTypeName[] = ["mentorjo", "brojo", "bestojo", "strictojo"];

export default function OjoNotificationPersonalitySettings({ onBack }: Props) {
  const colors = useColors();
  const { ojoName: chatOjoName } = useOjo();
  const { ojoEnabled, preferences, handleToggleOjoNotifications, handleSelectOjoType } = useNotificationSettings();

  const selectedType = preferences?.ojoNotifications?.selectedOjoType;
  const chatCfg = chatOjoName ? getOjoType((chatOjoName as OjoTypeName) ?? "mentorjo") : null;
  const ChatIcon = chatCfg ? (ICONS[chatCfg.icon as keyof typeof ICONS] ?? ICONS.ojo) : ICONS.ojo;
  const chatColor = chatCfg?.color ?? COLORS.primary3;
  const chatDisplayName = chatCfg?.displayName ?? "Mentorjo";

  // The currently active radio id
  const selectedId: string = !ojoEnabled ? "off" : !selectedType || selectedType === "auto" ? "auto" : selectedType;

  const options: RadioButtonOption[] = [
    {
      id: "off",
      label: "Off",
      description: "Standard templated notifications, no personality",
      value: "off",
      icon: <ICONS.ojo size={ICON_SIZES.sm} color={colors.gray2} />,
    },
    {
      id: "auto",
      label: "Auto",
      description: "Smart AI picks the best Ojo based on task difficulty",
      value: "auto",
      icon: <ICONS.puzzle size={ICON_SIZES.sm} color={COLORS.primary4} />,
    },
    {
      id: "chat",
      label: "Same as Chat Ojo",
      description: `Mirrors your chat personality (${chatDisplayName})`,
      value: "chat",
      icon: <ChatIcon size={ICON_SIZES.sm} color={chatColor} />,
    },
    ...OJO_TYPES.map((name) => {
      const cfg = getOjoType(name);
      const OjoFaceIcon = ICONS[cfg.icon as keyof typeof ICONS] ?? ICONS.ojo;
      return {
        id: name,
        label: cfg.displayName,
        description: cfg.tones.join(" · "),
        value: name,
        icon: <OjoFaceIcon size={ICON_SIZES.sm} color={cfg.color} />,
      };
    }),
  ];

  const handleSelect = async (_id: string, value: string) => {
    if (value === "off") {
      await handleToggleOjoNotifications(false);
    } else {
      await handleSelectOjoType(value as OjoType);
    }
  };

  return (
    <SettingsSubScreen title="Ojo Personality" iconName="ojo" scrollKey="ojo-notification-personality" onBack={onBack}>
      <Box>
        <View style={styles.boxContent}>
          <AppText variant="notes">Choose who delivers your notification reminders</AppText>
          <RadioButtonGroup
            options={options}
            selectedId={selectedId}
            onSelect={(id, value) => handleSelect(id, value)}
          />
        </View>
      </Box>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  boxContent: { gap: SPACING.md },
});
