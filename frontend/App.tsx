import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import ThemeShowcase from './ThemeShowcase';

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return ( 
    <View style={styles.container} onLayout={onLayoutRootView}> 
      <ThemeShowcase /> 
      <StatusBar style="auto" /> 
    </View> 
  ); 
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
