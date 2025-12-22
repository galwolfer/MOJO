import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useAuth } from "../../context/AuthContext";

type NavBarProps = {
  show?: boolean;
};

export default function NavBar({ show = true }: NavBarProps) {
  const { signOut } = useAuth();

  if (!show) return null;

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to logout?")) {
        signOut();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: signOut },
      ]);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={handleLogout}>
        <ICONS.user size={ICON_SIZES.big} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.ojo size={ICON_SIZES.big * 1.7} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.list size={ICON_SIZES.big} color={COLORS.primary1} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === "web" ? SPACING.lg : SPACING.lg,
    paddingHorizontal: SPACING.xlg,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SPACING.xlg,
    borderTopRightRadius: SPACING.xlg,
    height: SPACING.xlg * 3 + (Platform.OS !== "web" ? SPACING.lg : 0),
    ...(SHADOWS.card as object),
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
