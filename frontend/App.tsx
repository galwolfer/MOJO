import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import ThemeShowcase from "./ThemeShowcase";
import { COLORS, SPACING } from "./theme";

// Keep the splash screen visible while we fetch resources
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

  // Call layout-related hooks before any early returns so hooks order stays stable
  const { width, height } = useWindowDimensions();
  // treat wide viewports as desktop where we center a mobile-sized device
  const isDesktopLike = Platform.OS === "web" ? width >= 900 : width >= 900;

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;

  const deviceWidth = 700; // target mobile device width on desktop
  const deviceHeight = Math.min(height, 1000); // keep some margin

  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={outerStyle} onLayout={onLayoutRootView}>
        <View style={deviceStyle}>
          <ThemeShowcase />
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
    gap: SPACING.md,
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
    // shadow (works on native); web will approximate
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
  text: {
    fontSize: 16,
  },
  title: {
    fontFamily: "Fredoka-Bold",
    fontSize: 24,
    color: "#2c3e50",
  },
  regular: {
    fontFamily: "Fredoka-Regular",
    fontSize: 18,
  },
  bold: {
    fontFamily: "Fredoka-Bold",
    fontSize: 18,
  },
});
