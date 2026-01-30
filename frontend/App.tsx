// #file:App.tsx
import React, { useCallback, useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AuthScreen from "./screens/auth/Auth";
import { COLORS } from "./theme";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NavigationProvider } from "./context/NavigationContext";
import { LayoutProvider } from "./context/LayoutContext";
import { TaskProvider } from "./context/TaskContext";
import { OjoProvider } from "./context/OjoContext";
import { NotificationProvider } from "./context/NotificationContext";
import MainLayout from "./components/layout/MainLayout";
import LoadingScreen from "./components/special/LoadingScreen";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    "Fredoka-Bold": require("./assets/fonts/Fredoka-Bold.ttf"),
    "Fredoka-Light": require("./assets/fonts/Fredoka-Light.ttf"),
    "Fredoka-Medium": require("./assets/fonts/Fredoka-Medium.ttf"),
    "Fredoka-Regular": require("./assets/fonts/Fredoka-Regular.ttf"),
    "Fredoka-SemiBold": require("./assets/fonts/Fredoka-SemiBold.ttf"),
  });

  // Hide Expo splash screen immediately when component mounts so custom loading screen is visible
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // App is ready when fonts are loaded and auth state is resolved
  const isAppReady = (fontsLoaded || !!fontError) && !isLoading;

  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);
  }, []);

  const { width, height } = useWindowDimensions();
  const isDesktopLike = (Platform as any).OS === "web" ? width >= 1000 : width >= 1000;

  // Show loading screen overlay
  if (showLoadingScreen) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <LoadingScreen onLoadingComplete={handleLoadingComplete} isAppReady={isAppReady} />
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!isAppReady) {
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
  const deviceWidth = isDesktopLike ? width : 800;
  const deviceHeight = Math.min(height, 1300);
  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={outerStyle}>
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
      <NotificationProvider>
        <NavigationProvider>
          <LayoutProvider>
            <OjoProvider>
              <TaskProvider>
                <AppContent />
              </TaskProvider>
            </OjoProvider>
          </LayoutProvider>
        </NavigationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "red",
    width: "100%",
  },
  loadingContainer: {
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
    flex: 1, // Ensure it takes full height
  },
  deviceFull: {
    flex: 1,
    width: "100%",
    backgroundColor: "red",
  },
});
