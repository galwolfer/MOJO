import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import { COLORS, SPACING } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import { Box, BoxContainer } from "../components";

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
    <BoxContainer>
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
    </BoxContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: "center",
  },
});
