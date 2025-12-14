// #file:App.tsx
import React, { useCallback, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import ThemeShowcase from "./ThemeShowcase";
import Header from "./components/common/Header";
import NavBar from "./components/common/NavBar";
import { COLORS, SPACING } from "./theme";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "Fredoka-Bold": require("./assets/fonts/Fredoka-Bold.ttf"),
    "Fredoka-Light": require("./assets/fonts/Fredoka-Light.ttf"),
    "Fredoka-Medium": require("./assets/fonts/Fredoka-Medium.ttf"),
    "Fredoka-Regular": require("./assets/fonts/Fredoka-Regular.ttf"),
    "Fredoka-SemiBold": require("./assets/fonts/Fredoka-SemiBold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const { width, height } = useWindowDimensions();
  const isDesktopLike = (Platform as any).OS === "web" ? width >= 900 : width >= 900;

  // Measure header height so the scroll content always starts *under* it.
  const [headerHeight, setHeaderHeight] = useState(0);
  // We add paddingTop = headerHeight so the first scroll item is not hidden behind the header.
  // Call useMemo before any early returns so hook order remains stable between renders.
  const showcaseContentStyle = useMemo(
    () => [
      styles.scrollContent,
      {
        paddingTop: headerHeight + SPACING.md,
        paddingBottom: SPACING.xlg * 2,
      },
    ],
    [headerHeight]
  );

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;

  const deviceWidth = 700;
  const deviceHeight = Math.min(height, 1000);

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
            <Header title="MOJO" logo={null} show={true}>
              {/* Header children (optional) */}
            </Header>
          </View>

          {/* Fixed bottom nav overlay */}
          <View style={styles.footerOverlay} pointerEvents="box-none">
            <NavBar />
          </View>

          {/* Scroll area: starts below header */}
          <View style={styles.content}>
            <ThemeShowcase contentContainerStyle={showcaseContentStyle} />
          </View>
        </View>

        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
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
