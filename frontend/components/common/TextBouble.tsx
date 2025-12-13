// #file:TextBouble.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS, SHADOWS, SPACING } from "../../theme";
import ConicGradientBubble from "../special/ConicGradientBubble";

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

const DEFAULT_CPS = 50;

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
    // Use the glowing message shadow for user too
    return SHADOWS.glowingMessage as ViewStyle;
  }

  return SHADOWS.glowingMessage as ViewStyle;
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
        const useNativeDriver = (Platform as any).OS === "web" ? false : false;

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
      const childProps: any = (children as any).props || {};
      const mergedStyle = [childProps.style, mode === "user" ? { color: COLORS.colorWhite } : undefined];
      return React.cloneElement(children as any, { style: mergedStyle }, typed);
    }
    return <Text style={[styles.text, mode === "user" ? { color: COLORS.colorWhite } : undefined]}>{typed}</Text>;
  }, [children, typed, mode]);

  const renderContent =
    resolvedTypewriter && mode === "agent" && fullText != null ? (
      typedContent
    ) : React.isValidElement(children) ? (
      React.cloneElement(children as any, {
        style: [(children as any).props?.style, mode === "user" ? { color: COLORS.colorWhite } : undefined],
      })
    ) : typeof children === "string" ? (
      <Text style={[styles.text, mode === "user" ? { color: COLORS.colorWhite } : undefined]}>{children}</Text>
    ) : (
      children
    );

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
                  // On web, inherit bubble border so the conic gradient aligns with container edges
                  ...((Platform as any).OS === "web" ? { borderWidth: 0.15, borderColor: COLORS.brightP1 } : {}),
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
        {renderContent}
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
    zIndex: (Platform as any).OS === "web" ? 0 : undefined,
  },

  // "glowingMessage shadow" approximation (uses theme if exists)
  glow: {
    position: "absolute",
    backgroundColor: "transparent",
    ...(SHADOWS.glowingMessage as ViewStyle),
  },

  text: {
    color: COLORS.black,
  },
});

export default TextBouble;
