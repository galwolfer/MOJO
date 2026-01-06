import React from "react";
import { StyleProp, View, ViewStyle, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { GLASS, COMPONENT_STYLES, COLORS, SPACING } from "../../theme";
import { canUseNativeBlur } from "../../utils/blurSupport";

type GlassSurfaceProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
};

export default function GlassSurface({ children, style, intensity = 50, pointerEvents }: GlassSurfaceProps) {
  const useNativeBlur = canUseNativeBlur();
  // On Android where blur is not supported, render a solid white surface (no glass effect)
  const androidNoBlur = Platform.OS === "android" && !useNativeBlur;
  if (androidNoBlur) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[
          // allow other layout styles but **force** an opaque white background
          style,
          { backgroundColor: COLORS.colorWhite, borderRadius: SPACING.lg, opacity: 1 },
        ]}
      >
        {children}
      </View>
    );
  }

  const Surface = useNativeBlur ? BlurView : View;

  // Always use the component-level glass surface so platforms without native blur
  // still receive the translucent background, border and rounded corners.
  const surfaceStyle = COMPONENT_STYLES.glassSurface;

  // Always render the gloss overlay so platforms without native blur still show a glassy highlight
  const showGloss = true;
  const intensityFactor = Math.max(0, Math.min(1, intensity / 100));

  return (
    <Surface
      {...(useNativeBlur ? { intensity, tint: "light" } : {})}
      pointerEvents={pointerEvents}
      style={[surfaceStyle, style]}
    >
      {showGloss && (
        <LinearGradient
          colors={[GLASS.highlight, GLASS.shade, GLASS.shade]}
          locations={[0, 0.45, 1]}
          style={styles.glossOverlay}
          pointerEvents="none"
        />
      )}

      {/* Fallback blur simulation for platforms without native blur (e.g., many Android devices).
          Header/NavBar/Button all can share the same perceived "blurriness". */}
      {!useNativeBlur && <View style={[styles.fauxBlurOverlay]} pointerEvents="none" />}

      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  glossOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  fauxBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS.surface,
  },
  opaqueFallback: {
    backgroundColor: COLORS.white,
  },
});
