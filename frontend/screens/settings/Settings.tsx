import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import ProfileSettings from "./ProfileSettings";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useNavigation } from "../../context/NavigationContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import Box from "../../components/layout/Box";
import List, { ListCellProps } from "../../components/layout/List";
import ListItem, { makeListCell } from "../../components/layout/ListItem";
import { moderateScale } from "react-native-size-matters";
import { deleteAccount } from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";

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
  onEditPreferences?: () => void;
  onChatSettings?: () => void;
};

export default function SettingsScreen({ onBack, onEditPreferences, onChatSettings }: SettingsScreenProps) {
  const { user, signOut, signIn, token } = useAuth();
  const { setHeaderConfig } = useNavigation();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LeftIcon = ICONS.left;
  const SettingsIcon = ICONS.settings;
  const UserIcon = ICONS.user;
  const EditIcon = ICONS.prefrences;
  const ChatIcon = ICONS.ojo;
  const NotificationIcon = ICONS.notifications;
  const PencilIcon = ICONS.edit;

  useEffect(() => {
    setHeaderConfig({
      title: "Settings",
      show: true,
      icon: ICONS.settings,
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerRightTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerLeft}>
          <SettingsIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  const handleEditPreferences = () => {
    if (onEditPreferences) {
      onEditPreferences();
    } else {
      console.log("Edit preferences pressed - no handler provided");
    }
  };

  const handleChatSettings = () => {
    if (onChatSettings) {
      onChatSettings();
    } else {
      console.log("Chat settings pressed - no handler provided");
    }
  };

  const handleNotifications = () => {
    // TODO: Navigate to notifications settings screen
    console.log("Notifications pressed");
  };

  const preferenceItems: ListCellProps[] = [
    makeListCell("edit-preferences", {
      title: "Edit my prefrences",
      logo: <EditIcon size={24} color={COLORS.primary2} />,
      onPress: handleEditPreferences,
      divider: true,
    }),
    makeListCell("chat-settings", {
      title: "Chat settings",
      logo: <ChatIcon size={24} color={COLORS.primary1} />,
      onPress: handleChatSettings,
      divider: true,
    }),
    makeListCell("notifications", {
      title: "Notifications",
      logo: <NotificationIcon size={24} color={COLORS.primary5} />,
      onPress: handleNotifications,
      divider: false,
    }),
  ];

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Delete cancelled"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              setIsSaving(true);
              console.log("Deleting account...");
              await deleteAccount();
              console.log("Account deleted successfully");
              // Sign out after account deletion
              await signOut();
            } catch (err: any) {
              console.error("Error deleting account:", err);
              setError(err?.message || "Failed to delete account");
              setIsSaving(false);
            }
          },
          style: "destructive",
        },
      ],
    );
  };

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

      {/* Logout & Delete Row */}
      <View style={styles.signButtonsRow}>
        <AppButton title="Logout" onPress={signOut} mode="light" color="primary7" />
        <AppButton
          title="Delete Account"
          onPress={handleDeleteAccount}
          mode="light"
          color="lightGray"
          disabled={isSaving}
        />
      </View>
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
    color: COLORS.black,
  },
});
