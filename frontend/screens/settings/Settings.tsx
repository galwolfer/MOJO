import React, { useLayoutEffect, useState, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import PopupBox from "../../components/common/PopupBox";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import ErrorText from "../../components/common/ErrorText";
import ProfileSettings from "./screens/ProfileSettings";
import EditPreferencesScreen from "./screens/EditPreferences";
import ChatSettingsScreen from "./screens/ChatSettings";
import NotificationSettingsScreen from "./screens/NotificationSettings";
import AccessibilitySettingsScreen from "./screens/AccessibilitySettings";
import SubcategoryManager from "./screens/SubcategoryManager";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { useNavigation } from "../../context/NavigationContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import Box from "../../components/layout/Box";
import List, { ListCellProps } from "../../components/layout/List";
import ListItem, { makeListCell } from "../../components/layout/ListItem";
import { moderateScale } from "react-native-size-matters";
import { useAuth } from "../../context/AuthContext";

type CurrentScreen =
  | "main"
  | "edit-preferences"
  | "chat-settings"
  | "notification-settings"
  | "accessibility-settings"
  | "subcategory-manager";

/**
 * SettingsScreen
 *
 * Displays user settings with:
 * - Profile settings section with user info
 * - My Preferences section with various settings options
 * - Sign out button
 */

type SettingsScreenProps = {
  onBack: () => void;
};

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const colors = useColors();
  const { user, signOut, signIn, token } = useAuth();
  const { setHeaderConfig } = useNavigation();

  const [currentScreen, setCurrentScreen] = useState<CurrentScreen>("main");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store onBack in a ref to avoid recreating header config
  const onBackRef = useRef(onBack);
  useLayoutEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const LeftIcon = ICONS.left;
  const SettingsIcon = ICONS.settings;
  const UserIcon = ICONS.user;
  const EditIcon = ICONS.prefrences;
  const ChatIcon = ICONS.ojo;
  const NotificationIcon = ICONS.notifications;
  const AccessibilityIcon = ICONS.settings;
  const PencilIcon = ICONS.edit;
  const ListIcon = ICONS.list;

  useLayoutEffect(() => {
    if (currentScreen !== "main") return;
    const handleBackPress = () => onBackRef.current();
    setHeaderConfig({
      title: "Settings",
      show: true,
      icon: ICONS.settings,
      leftElement: (
        <TouchableOpacity onPress={handleBackPress}>
          <LeftIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerLeft}>
          <SettingsIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </View>
      ),
    });
  }, [currentScreen]);

  const handleEditPreferences = () => setCurrentScreen("edit-preferences");
  const handleChatSettings = () => setCurrentScreen("chat-settings");
  const handleNotifications = () => setCurrentScreen("notification-settings");
  const handleAccessibility = () => setCurrentScreen("accessibility-settings");
  const handleSubcategoryManager = () => setCurrentScreen("subcategory-manager");

  const preferenceItems: ListCellProps[] = [
    makeListCell("edit-preferences", {
      title: "Edit my prefrences",
      logo: <EditIcon size={ICON_SIZES.sm} color={COLORS.primary2} />,
      onPress: handleEditPreferences,
      divider: true,
    }),
    makeListCell("subcategories", {
      title: "Subcategories",
      logo: <ListIcon size={ICON_SIZES.sm} color={COLORS.primary4} />,
      onPress: handleSubcategoryManager,
      divider: true,
    }),
    makeListCell("chat-settings", {
      title: "Chat settings",
      logo: <ChatIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
      onPress: handleChatSettings,
      divider: true,
    }),
    makeListCell("notifications", {
      title: "Notifications",
      logo: <NotificationIcon size={ICON_SIZES.sm} color={COLORS.primary5} />,
      onPress: handleNotifications,
      divider: true,
    }),
    makeListCell("accessibility", {
      title: "Accessibility",
      logo: <AccessibilityIcon size={ICON_SIZES.sm} color={COLORS.primary3} />,
      onPress: handleAccessibility,
      divider: false,
    }),
  ];

  if (currentScreen === "edit-preferences") return <EditPreferencesScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "chat-settings") return <ChatSettingsScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "notification-settings")
    return <NotificationSettingsScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "accessibility-settings")
    return <AccessibilitySettingsScreen onBack={() => setCurrentScreen("main")} />;
  if (currentScreen === "subcategory-manager") return <SubcategoryManager onBack={() => setCurrentScreen("main")} />;

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      {/* Title moved to topbar */}

      {/* Profile Settings Section */}
      <ProfileSettings />

      {/* My Preferences Section */}
      <Box title="My Prefrences" titleColor={COLORS.primary1}>
        <View style={styles.preferencesContent}>
          <List data={preferenceItems} />
        </View>
      </Box>

      {/* Logout button only */}
      <View style={styles.signButtonsRow}>
        <AppButton title="Logout" onPress={signOut} mode="light" color="primary7" />
      </View>

      {error && <ErrorText>{error}</ErrorText>}
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    gap: SPACING.lg,
    paddingBottom: SPACING.xlg * 6,
  },

  // Header Button
  headerRight: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRightTouchable: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  signButtonsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },

  // Preferences Content
  preferencesContent: {
    width: "100%",
    paddingVertical: SPACING.sm,
  },

  preferenceIcon: {
    width: moderateScale(24),
    alignItems: "center",
  },
  preferenceText: {
    // color: applied dynamically via colors.text1
  },
});
