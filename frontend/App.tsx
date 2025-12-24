// #file:App.tsx
import React, { useCallback, useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AuthScreen from "./screens/Auth";
import { COLORS } from "./theme";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NavigationProvider } from "./context/NavigationContext";
import MainLayout from "./components/layout/MainLayout";

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

  if ((!fontsLoaded && !fontError) || isLoading) {
    return null;
  }

  // If user is logged in, MainLayout handles the frame/layout itself to support the complex nav/header structure.
  // If not, we wrap AuthScreen in the frame here.
  // Actually, to keep it consistent, let's have MainLayout handle the frame for authenticated user,
  // and we handle the frame for AuthScreen here.
  // OR better: MainLayout is just the content, and we keep the frame here?
  // The issue is MainLayout needs to stack Header/Content/Nav.
  // If we keep the frame here, we just render MainLayout inside it.

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;
  const deviceWidth = 700;
  const deviceHeight = Math.min(height, 1300);
  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={outerStyle} onLayout={onLayoutRootView}>
        {/* If user is logged in, we delegate full control to MainLayout which includes the frame logic internally if needed, 
            OR we wrap it here. 
            MainLayout currently implements the frame logic itself. So we should just render it directly if user is logged in.
            However, AuthScreen needs the frame too.
        */}

        {user ? (
          <MainLayout />
        ) : (
          <View style={deviceStyle}>
            <AuthScreen />
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
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
    flex: 1, // Ensure it takes full height
  },
  deviceFull: {
    flex: 1,
    width: "100%",
  },
});
