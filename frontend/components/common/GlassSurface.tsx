/**
 * GlassSurface
 *
 * Lightweight surface component that provides a consistent "glass" visual across
 * platforms. Uses native blur where available (`BlurView`) and falls back to a
 * translucent overlay + linear gradient gloss for platforms without native blur.
 *
 * Props:
 * - `intensity` (number): blur intensity (0-100) when native blur is available.
 * - `pointerEvents` (string): forwarded to the surface element.
 * - `style` (StyleProp<ViewStyle>): additional container styles.
 *
 * Usage:
 * <GlassSurface intensity={50}><Content /></GlassSurface>
 */
import React from "react";
import { StyleProp, View, ViewStyle, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { GLASS, COMPONENT_STYLES, COLORS, SPACING } from "../../theme";
import { useColors, useTheme } from "../../context/ThemeContext";
import { canUseNativeBlur } from "../../utils/blurSupport";

type GlassSurfaceProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
};

export default function GlassSurface({ children, style, intensity = 50, pointerEvents }: GlassSurfaceProps) {
  const { resolvedTheme } = useTheme();
  const colors = useColors();
  const useNativeBlur = canUseNativeBlur();

  const isDark = resolvedTheme === "dark";

  // Create dynamic glass colors based on the current theme mode
  const dynamicGlass = {
    surface: isDark ? COLORS.black : GLASS.surface,
    border: isDark ? COLORS.black2 : GLASS.border,
    highlight: isDark ? COLORS.black2 : GLASS.highlight,
    shade: isDark ? COLORS.black1 : GLASS.shade,
  };

  // On Android where blur is not supported, render a solid white surface (no glass effect)
  const androidNoBlur = Platform.OS === "android" && !useNativeBlur;
  if (androidNoBlur) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[style, { backgroundColor: colors.bg2, borderRadius: SPACING.lg, opacity: 1 }]}
      >
        {children}
      </View>
    );
  }

  const Surface = useNativeBlur ? BlurView : View;

  // Always use the component-level glass surface so platforms without native blur
  // still receive the translucent background, border and rounded corners.
  const surfaceStyle = [
    COMPONENT_STYLES.glassSurface,
    {
      backgroundColor: dynamicGlass.surface,
      borderColor: dynamicGlass.border,
    },
  ];

  // Always render the gloss overlay so platforms without native blur still show a glassy highlight
  const showGloss = true;
  const intensityFactor = Math.max(0, Math.min(1, intensity / 100));

  return (
    <Surface
      {...(useNativeBlur ? { intensity, tint: isDark ? "dark" : "light" } : {})}
      pointerEvents={pointerEvents}
      style={[surfaceStyle, style]}
    >
      {showGloss && (
        <LinearGradient
          colors={[dynamicGlass.highlight, dynamicGlass.shade, dynamicGlass.shade]}
          locations={[0, 0.45, 1]}
          style={styles.glossOverlay}
          pointerEvents="none"
        />
      )}

      {/* Fallback blur simulation for platforms without native blur (e.g., many Android devices).
          Header/NavBar/Button all can share the same perceived "blurriness". */}
      {!useNativeBlur && (
        <View style={[styles.fauxBlurOverlay, { backgroundColor: dynamicGlass.surface }]} pointerEvents="none" />
      )}

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
