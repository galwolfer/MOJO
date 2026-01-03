import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import { COLORS, SPACING } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import { Box } from "../components";
import ScrollableContent from "../components/layout/ScrollableContent";

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();
  const { setHeaderConfig } = useNavigation();

  useEffect(() => {
    setHeaderConfig({
      title: "User Profile",
      show: true,
      icon: ICONS.user,
    });
  }, []);

  return (
    <ScrollableContent respectHeader={true} respectNavBar={true} contentContainerStyle={styles.contentContainer}>
      <Box title="User Information">
        <AppText variant="boldText">Username:</AppText>
        <AppText variant="bodyText">{user?.username}</AppText>

        {user?.displayName && (
          <>
            <AppText variant="boldText" style={{ marginTop: SPACING.sm }}>
              Display Name:
            </AppText>
            <AppText variant="bodyText">{user.displayName}</AppText>
          </>
        )}

        {user?.email && (
          <>
            <AppText variant="boldText" style={{ marginTop: SPACING.sm }}>
              Email:
            </AppText>
            <AppText variant="bodyText">{user.email}</AppText>

            <AppButton
              title="Logout"
              onPress={signOut}
              mode="light"
              style={{ marginTop: SPACING.xlg, width: "100%" }}
            />
          </>
        )}
      </Box>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SPACING.md,
    alignItems: "stretch",
    gap: SPACING.lg,
  },
});
