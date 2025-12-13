// #file:TextBouble.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS, SHADOWS, SPACING } from "../../theme";
import ConicGradientBubble from "../special/ConicGradientBubble";
import { BoxShadow } from "@shopify/react-native-skia";

export type TextBoubleMode = "agent" | "user";

type Props = {
  style?: ViewStyle;
  children?: React.ReactNode;

  mode?: TextBoubleMode;

  // Agent typing
  text?: string; // If provided, used for typewriter (preferred over children)
  typewriter?: boolean; // Default: true for agent, false for user
  typingSpeedCps?: number; // chars per second, default 100
  onTypingDone?: () => void;
};

const DEFAULT_CPS = 100;

// Notes inside the code are in English
function extractPlainText(node: React.ReactNode): string | null {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    const parts = node.map(extractPlainText).filter((x): x is string => typeof x === "string" && x.length > 0);
    return parts.length ? parts.join("") : null;
  }

  if (React.isValidElement(node)) {
    return extractPlainText((node.props as any)?.children);
  }

  return null;
}

function pickText(children: React.ReactNode, text?: string): string | null {
  if (typeof text === "string") return text;
  return extractPlainText(children);
}

function getRadii(mode: TextBoubleMode) {
  const xlg = SPACING.xlg;
  const sm = SPACING.sm;

  if (mode === "user") {
    // All xlg except top-left
    return {
      borderTopLeftRadius: xlg,
      borderTopRightRadius: sm,
      borderBottomRightRadius: xlg,
      borderBottomLeftRadius: xlg,
    };
  }

  // agent: All xlg except top-right
  return {
    borderTopLeftRadius: sm,
    borderTopRightRadius: xlg,
    borderBottomRightRadius: xlg,
    borderBottomLeftRadius: xlg,
  };
}

function getContainerBackground(mode: TextBoubleMode) {
  if (mode === "user") return COLORS.primary1; // p1 color
  return COLORS.white2;
}

function getContainerShadow(mode: TextBoubleMode) {
  // "user - normal shadow present"
  if (mode === "user") {
    return {
      shadowColor: COLORS.primary1,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2,
      elevation: 3,
    } as const;
  }

  return {
    BoxShadow: SHADOWS.glowingMessage,
  } as const;
}

const TextBouble: React.FC<Props> = ({
  style,
  children,
  mode = "agent",
  text,
  typewriter,
  typingSpeedCps = DEFAULT_CPS,
  onTypingDone,
}) => {
  const resolvedTypewriter = typewriter ?? mode === "agent";
  const fullText = useMemo(() => pickText(children, text), [children, text]);

  const [typed, setTyped] = useState(() => (resolvedTypewriter ? "" : fullText ?? ""));
  const [showConic, setShowConic] = useState(() => mode === "agent" && resolvedTypewriter && !!fullText);

  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);

  // Cross-fade shadow layers (agent only)
  const conicOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset whenever content/mode changes
    const nextFull = pickText(children, text);
    const shouldType = (typewriter ?? mode === "agent") && mode === "agent" && !!nextFull;

    setTyped(shouldType ? "" : nextFull ?? "");
    setShowConic(shouldType);

    // If typing: conic visible, glow hidden. Otherwise: glow visible for agent, hidden for user.
    conicOpacity.setValue(shouldType ? 1 : 0);
    glowOpacity.setValue(mode === "agent" && !shouldType ? 1 : 0);

    if (!shouldType || !nextFull) return;

    startTsRef.current = null;

    const step = (ts: number) => {
      if (startTsRef.current == null) startTsRef.current = ts;

      const elapsedSec = (ts - startTsRef.current) / 1000;
      const targetChars = Math.min(nextFull.length, Math.floor(elapsedSec * typingSpeedCps));

      setTyped((prev) => {
        if (prev.length === targetChars) return prev;
        return nextFull.slice(0, targetChars);
      });

      if (targetChars >= nextFull.length) {
        onTypingDone?.();

        // On mobile, animating opacity via JS driver is more reliable
        // when the gradient component is SVG/complex.
        const useNativeDriver = Platform.OS === "web" ? false : false;

        Animated.parallel([
          Animated.timing(conicOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ]).start(({ finished }) => {
          // Stop rendering the dynamic gradient once the fade completes
          if (finished) setShowConic(false);
        });

        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, text, mode, typewriter, typingSpeedCps]);

  const radii = useMemo(() => getRadii(mode), [mode]);
  const containerBg = useMemo(() => getContainerBackground(mode), [mode]);
  const containerShadow = useMemo(() => getContainerShadow(mode), [mode]);

  const typedContent = useMemo(() => {
    // Keep the original typography on mobile/web by cloning the provided text element (e.g., AppText)
    if (React.isValidElement(children)) {
      return React.cloneElement(children as any, undefined, typed);
    }
    return <Text style={styles.text}>{typed}</Text>;
  }, [children, typed]);

  return (
    <View style={[styles.wrapper, style]}>
      {mode === "agent" && (
        <>
          {/* Dynamic conic shadow (only while typing) */}
          {showConic && (
            <Animated.View pointerEvents="none" style={[styles.shadowLayer, { opacity: conicOpacity }]}>
              <ConicGradientBubble
                style={{
                  ...styles.conic,
                  ...radii,
                  // Keep the old look: only web uses CSS blur; native keeps the component's original rendering
                  filter: "blur(10px)",
                }}
              />
            </Animated.View>
          )}

          {/* Static glowing shadow (visible after typing or when typewriter is off) */}
          <Animated.View pointerEvents="none" style={[styles.shadowLayer, { opacity: glowOpacity }]}>
            <View style={[styles.glow, radii]} />
          </Animated.View>
        </>
      )}

      <View style={[styles.containerBase, radii, containerShadow, { backgroundColor: containerBg }]}>
        {resolvedTypewriter && mode === "agent" && fullText != null ? typedContent : children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "stretch",
  },

  shadowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  containerBase: {
    flexDirection: "column",
    height: "auto",
    padding: 17,
    alignItems: "flex-start",
    gap: 17,
    alignSelf: "stretch",
  },

  // Match the original “halo” sizing on mobile/web
  conic: {
    position: "absolute",
    top: -18,
    left: -18,
    right: -18,
    bottom: -18,
    zIndex: Platform.OS === "web" ? 0 : undefined,
  },

  // "glowingMessage shadow" approximation (uses theme if exists)
  glow: {
    position: "absolute",
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    backgroundColor: "transparent",
    ...(SHADOWS?.glowingMessage ?? {
      shadowColor: COLORS.primary1,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 10,
    }),
  },

  text: {
    color: COLORS.black,
  },
});

export default TextBouble;
