import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/common/AppText";
import Input from "../components/inputs/Input";
import { COLORS, SPACING, ICON_SIZES } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";

export default function ChatScreen() {
  const { setHeaderConfig, setNavBarConfig } = useNavigation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Configure Header
    setHeaderConfig({
      title: "Mojo",
      show: true,
      icon: ICONS.ojo,
    });

    // Configure NavBar with Chat Input
    setNavBarConfig({
      show: true,
      widget: (
        <View style={styles.inputContainer}>
          <Input
            placeholder="Type a message..."
            value={message}
            onChangeText={setMessage}
            // Add send button or logic here
          />
        </View>
      ),
    });

    // Cleanup when leaving screen
    return () => {
      setNavBarConfig({ show: true, widget: null });
    };
  }, [message]); // Re-run if message changes (if we want to keep input sync, though usually input state is local)
  // Actually, putting input in NavBar via context might cause re-renders or focus loss if not careful.
  // A better approach for input is usually to have it in the screen, but the user asked to "connect to the navbar".
  // If the input is IN the navbar, it persists at the bottom.

  return (
    <View style={styles.container}>
      <AppText variant="bodyText">Chat Screen Placeholder</AppText>
      <AppText variant="notes">Chat messages will go here...</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    width: "100%",
    backgroundColor: COLORS.white,
    // Add shadow or styling to make it look integrated
  },
});
