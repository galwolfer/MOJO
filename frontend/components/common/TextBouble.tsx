// #file:TextBouble.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS, SHADOWS, SPACING } from "../../theme";
import ConicGradientBubble from "../special/ConicGradientBubble";

export type TextBoubleMode = "agent" | "user";

/**
 * Isolated typewriter component that updates independently
 * without causing parent re-renders. Uses requestAnimationFrame
 * with direct text node updates for maximum performance.
 */
const TypewriterText = memo<{
  fullText: string;
  cps: number;
  onDone: () => void;
  textStyle?: any;
  children?: React.ReactNode;
}>(({ fullText, cps, onDone, textStyle, children }) => {
  const [displayText, setDisplayText] = useState("");
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);
  const isDoneRef = useRef(false);
  const lastCharCountRef = useRef(0);

  useEffect(() => {
    setDisplayText("");
    isDoneRef.current = false;
    startTsRef.current = null;
    lastCharCountRef.current = 0;

    const step = (ts: number) => {
      if (startTsRef.current == null) startTsRef.current = ts;

      const elapsedSec = (ts - startTsRef.current) / 1000;
      const targetChars = Math.min(fullText.length, Math.floor(elapsedSec * cps));

      // Only update if character count actually changed
      if (targetChars !== lastCharCountRef.current) {
        lastCharCountRef.current = targetChars;
        setDisplayText(fullText.slice(0, targetChars));
      }

      if (targetChars >= fullText.length) {
        if (!isDoneRef.current) {
          isDoneRef.current = true;
          onDone();
        }
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [fullText, cps, onDone]);

  if (React.isValidElement(children)) {
    return React.cloneElement(
      children as any,
      {
        style: [textStyle, (children as any).props?.style],
      },
      displayText
    );
  }

  return <Text style={textStyle}>{displayText}</Text>;
});

/**
 * Recursively clones React children, replacing text content with animated text
 * and keeping non-text elements hidden/faded during typing
 */
/**
 * Small helper that fades non-text elements in when `visible` becomes true.
 * Each instance manages its own Animated.Value so different elements can fade
 * independently when their preceding text finishes.
 */
const NonTextFade: React.FC<{ visible: boolean; style?: any; children?: React.ReactNode }> = ({
  visible,
  children,
  style,
}) => {
  // Do not render at all when not visible so it doesn't occupy layout space.
  if (!visible) return null;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in when mounted (visible true)
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim]);

  return <Animated.View style={[{ opacity: anim }, style]}>{children}</Animated.View>;
};

/**
 * Traverse children in-order and render content based on how many characters
 * have been typed so far (`typedChars`). Non-text elements are shown (with
 * a fade) once all prior text has been revealed.
 */
function cloneChildrenWithTyping(node: React.ReactNode, typedChars: number): React.ReactNode {
  if (node == null || typeof node === "boolean") return null;

  if (typeof node === "string" || typeof node === "number") {
    const str = String(node);
    if (typedChars <= 0) return "";
    return str.slice(0, Math.min(str.length, typedChars));
  }

  if (Array.isArray(node)) {
    let consumedSoFar = 0;
    const out: React.ReactNode[] = [];

    node.forEach((child, i) => {
      const childText = extractPlainText(child) || "";
      const childTextLen = childText.length;
      const remainingTyped = Math.max(0, typedChars - consumedSoFar);

      if (childTextLen > 0) {
        // Pass only the number of chars that belong to this child
        out.push(
          <React.Fragment key={i}>
            {cloneChildrenWithTyping(child, Math.min(remainingTyped, childTextLen))}
          </React.Fragment>
        );
        consumedSoFar += childTextLen;
      } else {
        // Non-text element: visible when any prior text has been revealed
        const visible = remainingTyped > 0;
        out.push(
          <React.Fragment key={i}>
            <NonTextFade visible={visible}>{child}</NonTextFade>
          </React.Fragment>
        );
      }
    });

    return <>{out}</>;
  }

  if (React.isValidElement(node)) {
    const props = node.props as any;
    const children = props?.children;

    const nodeText = extractPlainText(node) || "";
    const nodeTextLen = nodeText.length;

    if (nodeTextLen === 0) {
      // Element contains no text — treat it as a non-text element
      // It should be shown when preceding text has been typed. However,
      // at this level we don't know preceding text count, so the parent
      // array handler wraps non-text elements. For isolated elements here,
      // we show it if typedChars > 0.
      const visible = typedChars > 0;
      return <NonTextFade visible={visible}>{React.cloneElement(node as any, props)}</NonTextFade>;
    }

    // Element contains text: process its children with the available typedChars
    const processedChildren = cloneChildrenWithTyping(children, typedChars);
    return React.cloneElement(node as any, { ...props }, processedChildren);
  }

  return node;
}

/**
 * Component that renders children with typing animation and fade-in for non-text elements
 */
const AnimatedTypingContent: React.FC<{
  children: React.ReactNode;
  fullText: string;
  typedChars: number;
  nonTextOpacity: Animated.Value;
  mode: TextBoubleMode;
}> = ({ children, typedChars, nonTextOpacity, mode }) => {
  const content = cloneChildrenWithTyping(children, typedChars, nonTextOpacity);

  if (React.isValidElement(children)) {
    return React.cloneElement(
      children as any,
      {
        style: [(children as any).props?.style, mode === "user" ? { color: COLORS.colorWhite } : undefined],
      },
      content
    );
  }

  return <>{content}</>;
};

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

  const [showConic, setShowConic] = useState(() => mode === "agent" && resolvedTypewriter && !!fullText);
  const [isTyping, setIsTyping] = useState(() => mode === "agent" && resolvedTypewriter && !!fullText);

  // Cross-fade shadow layers (agent only)
  const conicOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  // Keep refs to running animations so we can stop them cleanly
  const conicAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade-in animation for non-text elements after typing completes
  const nonTextOpacity = useRef(new Animated.Value(0)).current;
  // Tracks whether we've already run the intro typing animation for this mount
  const animatedOnceRef = useRef(false);

  const handleTypingDone = useMemo(
    () => () => {
      onTypingDone?.();
      setIsTyping(false);
      // mark completed so we don't run again for the same mount
      animatedOnceRef.current = true;

      // On mobile, animating opacity via JS driver is more reliable
      // when the gradient component is SVG/complex.
      const useNativeDriver = (Platform as any).OS === "web" ? false : false;

      // ensure any prior animations are stopped
      try {
        conicAnimRef.current?.stop();
      } catch (_) {}
      try {
        glowAnimRef.current?.stop();
      } catch (_) {}

      const conicAnim = Animated.timing(conicOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      });
      const glowAnim = Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      });

      // Fade in non-text elements
      const fadeInNonText = Animated.timing(nonTextOpacity, {
        toValue: 1,
        duration: 400,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });

      conicAnimRef.current = conicAnim;
      glowAnimRef.current = glowAnim;

      Animated.parallel([conicAnim, glowAnim, fadeInNonText]).start(({ finished }) => {
        // clear refs
        conicAnimRef.current = null;
        glowAnimRef.current = null;
        // Stop rendering the dynamic gradient once the fade completes
        if (finished) setShowConic(false);
      });
    },
    [onTypingDone, conicOpacity, glowOpacity, nonTextOpacity]
  );

  useEffect(() => {
    // Run only once on mount to avoid re-triggering on layout changes (resize)
    // The initial content determines whether we should run the intro typewriter.
    const nextFull = pickText(children, text);
    const shouldType = (typewriter ?? mode === "agent") && mode === "agent" && !!nextFull;

    // Only start typing if we haven't done it for this mount yet
    const willType = shouldType && !animatedOnceRef.current;

    // stop any running animations immediately when initializing
    try {
      conicAnimRef.current?.stop();
    } catch (_) {}
    try {
      glowAnimRef.current?.stop();
    } catch (_) {}

    setIsTyping(willType);
    setShowConic(willType);

    // If typing: conic visible, glow hidden, non-text hidden. Otherwise: everything visible.
    conicOpacity.setValue(willType ? 1 : 0);
    glowOpacity.setValue(mode === "agent" && !willType ? 1 : 0);
    nonTextOpacity.setValue(willType ? 0 : 1);

    return () => {
      // stop any running Animated.CompositeAnimation instances
      try {
        conicAnimRef.current?.stop();
      } catch (_) {}
      conicAnimRef.current = null;
      try {
        glowAnimRef.current?.stop();
      } catch (_) {}
      glowAnimRef.current = null;

      // ensure the animated values are stopped and snapped to a final value
      try {
        conicOpacity.stopAnimation(() => {
          conicOpacity.setValue(0);
        });
      } catch (_) {
        conicOpacity.setValue(0);
      }
      try {
        const finalGlow = mode === "agent" && !willType ? 1 : 0;
        glowOpacity.stopAnimation(() => {
          glowOpacity.setValue(finalGlow);
        });
      } catch (_) {
        const finalGlow = mode === "agent" && !willType ? 1 : 0;
        glowOpacity.setValue(finalGlow);
      }
      try {
        nonTextOpacity.stopAnimation(() => {
          nonTextOpacity.setValue(willType ? 0 : 1);
        });
      } catch (_) {
        nonTextOpacity.setValue(willType ? 0 : 1);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const radii = useMemo(() => getRadii(mode), [mode]);
  const containerBg = useMemo(() => getContainerBackground(mode), [mode]);
  const containerShadow = useMemo(() => getContainerShadow(mode), [mode]);

  // Track typed character count for incremental rendering
  const [typedChars, setTypedChars] = useState(0);
  const typingRafRef = useRef<number | null>(null);
  const typingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTyping || !fullText) {
      setTypedChars(fullText?.length || 0);
      return;
    }

    // Start typewriter animation
    setTypedChars(0);
    typingStartRef.current = null;

    const animate = (ts: number) => {
      if (!typingStartRef.current) typingStartRef.current = ts;
      const elapsed = (ts - typingStartRef.current) / 1000;
      const target = Math.min(fullText.length, Math.floor(elapsed * typingSpeedCps));

      setTypedChars(target);

      if (target >= fullText.length) {
        typingRafRef.current = null;
        handleTypingDone();
        return;
      }

      typingRafRef.current = requestAnimationFrame(animate);
    };

    typingRafRef.current = requestAnimationFrame(animate);

    return () => {
      if (typingRafRef.current) cancelAnimationFrame(typingRafRef.current);
    };
  }, [isTyping, fullText, typingSpeedCps, handleTypingDone]);

  // Render full content (used as invisible placeholder during typing to reserve space)
  const fullContent = React.isValidElement(children) ? (
    React.cloneElement(children as any, {
      style: [(children as any).props?.style, mode === "user" ? { color: COLORS.colorWhite } : undefined],
    })
  ) : typeof children === "string" ? (
    <Text style={[styles.text, mode === "user" ? { color: COLORS.colorWhite } : undefined]}>{children}</Text>
  ) : (
    children
  );

  const shouldShowTypewriter = resolvedTypewriter && mode === "agent" && fullText != null;

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

      <View
        style={[styles.containerBase, radii, containerShadow, { backgroundColor: containerBg }]}
        renderToHardwareTextureAndroid={shouldShowTypewriter && isTyping}
        shouldRasterizeIOS={shouldShowTypewriter && isTyping}
      >
        {shouldShowTypewriter && isTyping ? (
          // Render typed content inline so the container height follows the
          // currently visible text. Non-text elements will not occupy space
          // until they become visible (so the box grows as typing advances).
          <>{cloneChildrenWithTyping(children, typedChars)}</>
        ) : (
          fullContent
        )}
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

  spacer: {
    opacity: 0,
    pointerEvents: "none",
  },

  typedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 17,
  },
});

export default TextBouble;
