import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useNavigation } from "../../context/NavigationContext";
import Header from "../common/Header";
import NavBar from "../common/NavBar";
import ChatScreen from "../../screens/Chat";
import CalendarScreen from "../../screens/Calendar";
import UserProfileScreen from "../../screens/UserProfile";
import { COLORS } from "../../theme";
import { useKeyboard } from "../../hooks";

export default function MainLayout() {
  const { activeTab, headerConfig, navBarConfig } = useNavigation();
  const { width, height } = useWindowDimensions();
  const isDesktopLike = Platform.OS === "web" ? width >= 900 : width >= 900;
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const keyboardOffset = keyboardVisible ? keyboardHeight : 0;
  const hasNavWidget = Boolean(navBarConfig.widget);

  const renderScreen = () => {
    switch (activeTab) {
      case "chat":
        return <ChatScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "user":
        return <UserProfileScreen />;
      default:
        return <ChatScreen />;
    }
  };

  // Calculate dynamic styles
  const deviceWidth = 700;
  const deviceHeight = Math.min(height, 1300);

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;
  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <View style={outerStyle}>
      <View style={deviceStyle}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Header
            title={headerConfig.title}
            show={headerConfig.show}
            Icon={headerConfig.icon}
            leftElement={headerConfig.leftElement}
            rightElement={headerConfig.rightElement}
            element={headerConfig.element}
          />
        </View>

        {/* Main Content */}
        <View
          style={[styles.content, keyboardVisible && !hasNavWidget ? { paddingBottom: keyboardOffset } : undefined]}
        >
          {renderScreen()}
        </View>

        {/* NavBar */}
        <View
          style={[
            styles.navBarContainer,
            keyboardOffset > 0 ? { transform: [{ translateY: -keyboardOffset }] } : undefined,
          ]}
        >
          <NavBar hideIcons={keyboardVisible && hasNavWidget} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  desktopOuter: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceFrame: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.white3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
    display: "flex",
    flexDirection: "column",
  },
  deviceFull: {
    flex: 1,
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  headerContainer: {
    zIndex: 10,
  },
  content: {
    flex: 1,
    // Ensure content doesn't get hidden behind header/nav if they were absolute
    // But here we are using flex column, so they stack naturally.
    // If Header/NavBar have absolute positioning in their own styles, we might need to adjust.
    // Based on previous App.tsx, they were absolute. Let's check Header/NavBar styles.
  },
  navBarContainer: {
    zIndex: 10,
    width: "100%",
  },
});
