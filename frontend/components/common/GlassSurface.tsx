import React from "react";
import { StyleProp, View, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { GLASS, COMPONENT_STYLES, COLORS } from "../../theme";
import { canUseNativeBlur } from "../../utils/blurSupport";

type GlassSurfaceProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
};

export default function GlassSurface({ children, style, intensity = 50, pointerEvents }: GlassSurfaceProps) {
  const useNativeBlur = canUseNativeBlur();
  const Surface = useNativeBlur ? BlurView : View;
  const surfaceStyle = useNativeBlur ? COMPONENT_STYLES.glassSurface : styles.opaqueFallback;

  return (
    <Surface
      {...(useNativeBlur ? { intensity, tint: "light" } : {})}
      pointerEvents={pointerEvents}
      style={[surfaceStyle, style]}
    >
      {useNativeBlur ? (
        <LinearGradient
          colors={[GLASS.highlight, GLASS.shade, GLASS.shade]}
          locations={[0, 0.45, 1]}
          style={styles.glossOverlay}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  glossOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  opaqueFallback: {
    backgroundColor: COLORS.white,
  },
});
