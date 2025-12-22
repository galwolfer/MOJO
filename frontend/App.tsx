// #file:App.tsx
import React, { useCallback, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AuthScreen from "./screens/Auth";
import Header from "./components/common/Header";
import NavBar from "./components/common/NavBar";
import { COLORS, SPACING } from "./theme";
import ThemeShowcase from "./ThemeShowcase";
import { AuthProvider, useAuth } from "./context/AuthContext";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    "Fredoka-Bold": require("./assets/fonts/Fredoka-Bold.ttf"),
    "Fredoka-Light": require("./assets/fonts/Fredoka-Light.ttf"),
    "Fredoka-Medium": require("./assets/fonts/Fredoka-Medium.ttf"),
    "Fredoka-Regular": require("./assets/fonts/Fredoka-Regular.ttf"),
    "Fredoka-SemiBold": require("./assets/fonts/Fredoka-SemiBold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && !isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  const { width, height } = useWindowDimensions();
  const isDesktopLike = (Platform as any).OS === "web" ? width >= 900 : width >= 900;

  // Measure header height so the scroll content always starts *under* it.
  const [headerHeight, setHeaderHeight] = useState(0);

  if ((!fontsLoaded && !fontError) || isLoading) {
    return null;
  }

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;

  const deviceWidth = 700;
  const deviceHeight = Math.min(height, 1300);

  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={outerStyle} onLayout={onLayoutRootView}>
        <View style={deviceStyle}>
          {/* Fixed header overlay */}
          <View
            style={styles.headerOverlay}
            onLayout={(e) => {
              const h = e?.nativeEvent?.layout?.height ?? 0;
              if (h && h !== headerHeight) setHeaderHeight(h);
            }}
          >
            {user && <Header title="MOJO" logo={null} show={true} />}
          </View>

          {/* Fixed bottom nav overlay */}
          <View style={styles.footerOverlay} pointerEvents="box-none">
            {user && <NavBar />}
          </View>

          {/* Scroll area: starts below header */}
          <View style={styles.content}>
            {!user ? (
              <AuthScreen />
            ) : (
              <View style={{ flex: 1, paddingTop: headerHeight }}>
                <ThemeShowcase />
              </View>
            )}
          </View>
        </View>

        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
    alignItems: "center",
    justifyContent: "center",
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
  },
  deviceFull: {
    flex: 1,
    width: "100%",
  },

  // Header sits on top, content scrolls underneath (but with paddingTop so it is visible)
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  footerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  content: {
    flex: 1,
  },

  scrollContent: {},
});
