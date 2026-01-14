/**
 * TextBouble
 *
 * Text bubble for chat UI. Renders typed text with a performant typewriter
 * animation for assistant messages and fades non-text children in when
 * preceding text finishes. Designed for high performance in long chat lists.
 *
 * Usage:
 * <TextBouble mode="agent" playOnceKey="chat:msg-id">
 *   <AppText>Message text</AppText>
 *   <Widget>...</Widget>
 * </TextBouble>
 */
import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS, SHADOWS, SPACING } from "../../../theme";
import ConicGradientBubble from "../../../components/special/ConicGradientBubble";
import { splitTextAndWidget } from "../../../utils/widgetParser";
import { WidgetRenderer } from "../../../utils/widgetFactory";
import AppText from "../../../components/common/AppText";

export type TextBoubleMode = "agent" | "user";

// Persistent map of played animations by key. When a `playOnceKey` is provided
// to `TextBouble`, the animation will only play once ever for that key
// (survives mount/unmount cycles during the app session).
const playedMap = new Map<string, boolean>();
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

  if (React.isValidElement(children) && (children as any).type !== React.Fragment) {
    return React.cloneElement(
      children as any,
      {
        style: [textStyle, (children as any).props?.style],
      },
      displayText
    );
  }

  // If a fragment or non-element was passed, render a Text fallback so we never
  // attach a `style` prop to React.Fragment (fragments only accept key/children).
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
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in when mounted (visible true)
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [anim, visible]);

  // Do not render at all when not visible so it doesn't occupy layout space.
  if (!visible) return null;

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
      // Avoid adding props to React.Fragment (fragments don't accept props)
      if ((node as any).type === React.Fragment) {
        return <NonTextFade visible={visible}>{node}</NonTextFade>;
      }
      return <NonTextFade visible={visible}>{React.cloneElement(node as any, props)}</NonTextFade>;
    }

    // Element contains text: process its children with the available typedChars
    const processedChildren = cloneChildrenWithTyping(children, typedChars);
    // Fragments cannot accept props; return the processed children directly for fragments
    if ((node as any).type === React.Fragment) {
      return <>{processedChildren}</>;
    }

    return React.cloneElement(node as any, { ...props }, processedChildren);
  }

  return node;
}

/**
 * Component that renders children with typing animation and fade-in for non-text elements
 */
const AnimatedTypingContent: React.FC<{
  children: React.ReactNode;
  typedChars: number;
  mode: TextBoubleMode;
}> = ({ children, typedChars, mode }) => {
  const content = cloneChildrenWithTyping(children, typedChars);

  if (React.isValidElement(children) && (children as any).type !== React.Fragment) {
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

  // If provided, the typewriter animation will only play once per-session
  // for this key. Useful to avoid replay when navigating back-and-forth.
  playOnceKey?: string;

  // Agent typing
  text?: string; // If provided, used for typewriter (preferred over children)
  typewriter?: boolean; // Default: true for agent, false for user
  typingSpeedCps?: number; // chars per second, default 100
  onTypingDone?: () => void;

  // Optional persona gradient colors for conic gradient display
  gradientColors?: string[] | undefined;

  // Widget action callback - called when user interacts with widget buttons
  onWidgetAction?: (actionId: string, actionData?: any) => void;
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

/**
 * Helper to extract display text for typewriter animation (strips widget JSON)
 * Only processes agent messages, returns text as-is for user messages
 */
function extractDisplayText(text: string | null, mode: TextBoubleMode): string | null {
  if (!text || mode !== "agent") return text;

  // Try to split text and widget - return only the text part for display
  const { beforeText, widget } = splitTextAndWidget(text);

  // If there's a widget, return only the text before it for typing display
  return widget ? beforeText : text;
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

function getContainerShadow(mode: TextBoubleMode, shadowColor?: string) {
  // "user - normal shadow present"
  if (mode === "user") {
    // Use the glowing message shadow for user too
    return SHADOWS.card as ViewStyle;
  } else {
    const base = { ...SHADOWS.glowingMessage } as ViewStyle;
    if (shadowColor) base.shadowColor = shadowColor;
    else base.shadowColor = COLORS.primary1;
    return base;
  }
}

const TextBouble: React.FC<Props> = ({
  style,
  children,
  mode = "agent",
  text,
  typewriter,
  typingSpeedCps = DEFAULT_CPS,
  onTypingDone,
  playOnceKey,
  gradientColors,
  onWidgetAction,
}) => {
  const resolvedTypewriter = typewriter ?? mode === "agent";

  // Extract raw text including potential widget JSON
  const rawText = useMemo(() => pickText(children, text), [children, text]);

  // Parse widget data from agent messages
  const parsedContent = useMemo(() => {
    if (!rawText || mode !== "agent") {
      return { displayText: rawText, widget: null };
    }
    const { beforeText, widget } = splitTextAndWidget(rawText);
    return {
      displayText: widget ? beforeText || null : rawText,
      widget,
    };
  }, [rawText, mode]);

  // Display text for typewriter (without widget JSON)
  const fullText = parsedContent.displayText;

  const [showConic, setShowConic] = useState(() => mode === "agent" && resolvedTypewriter && !!fullText);
  const [isTyping, setIsTyping] = useState(() => mode === "agent" && resolvedTypewriter && !!fullText);

  // Track whether the widget should be mounted and remain visible once shown.
  // We intentionally do NOT set it to false when typing restarts so the widget
  // remains visible after it's been revealed.
  const [widgetMounted, setWidgetMounted] = useState<boolean>(() => false);

  // Cross-fade shadow layers (agent only)
  const conicOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  // Keep refs to running animations so we can stop them cleanly
  const conicAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade-in animation for non-text elements after typing completes
  const nonTextOpacity = useRef(new Animated.Value(0)).current;

  // Track last seen meaningful inputs to avoid restarting animations on unrelated re-renders
  // Only run the typewriter the first time this TextBouble is shown.
  // Subsequent re-renders (e.g. showing inline error messages) should not restart it.
  const initializedRef = useRef(false);
  const playedRef = useRef<boolean>(Boolean(playOnceKey && playedMap.get(playOnceKey)));

  const handleTypingDone = useMemo(
    () => () => {
      onTypingDone?.();
      setIsTyping(false);
      // Ensure the widget is mounted/visible once typing completes
      try {
        setWidgetMounted(true);
      } catch (_) {}

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
        // Mark that we've completed the typing animation so it won't replay
        try {
          playedRef.current = true;
          if (playOnceKey) playedMap.set(playOnceKey, true);
        } catch (_) {}
      });
    },
    [onTypingDone, conicOpacity, glowOpacity, nonTextOpacity, setWidgetMounted]
  );

  useEffect(() => {
    // Initialize only once per mount/show. If the typewriter has already played
    // for this instance, do not restart it on subsequent re-renders (e.g., showing errors).
    const shouldType = (typewriter ?? mode === "agent") && mode === "agent" && !!fullText;

    if (!initializedRef.current) {
      initializedRef.current = true;

      // If we should type at first show, start typing. Otherwise show full content.
      if (shouldType && !playedRef.current) {
        setIsTyping(true);
        setShowConic(true);
        conicOpacity.setValue(1);
        glowOpacity.setValue(0);
        nonTextOpacity.setValue(0);
      } else {
        setIsTyping(false);
        setShowConic(false);
        conicOpacity.setValue(0);
        glowOpacity.setValue(mode === "agent" && !shouldType ? 1 : 0);
        nonTextOpacity.setValue(1);
        // If we are not typing, mark as played so we don't attempt later
        playedRef.current = true;
        if (playOnceKey) playedMap.set(playOnceKey, true);
        // If there's a widget and we're not typing, mount it immediately
        if (parsedContent.widget) setWidgetMounted(true);
      }
    } else {
      // Already initialized: don't restart animations on re-renders. But if typing
      // was never played and now shouldType becomes true, allow it once.
      if (!playedRef.current && shouldType && !isTyping) {
        setIsTyping(true);
        setShowConic(true);
        conicOpacity.setValue(1);
        glowOpacity.setValue(0);
        nonTextOpacity.setValue(0);
      } else {
        // Keep current visual state (do not restart)
      }
    }

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
        const finalGlow = mode === "agent" && !shouldType ? 1 : 0;
        glowOpacity.stopAnimation(() => {
          glowOpacity.setValue(finalGlow);
        });
      } catch (_) {
        const finalGlow = mode === "agent" && !shouldType ? 1 : 0;
        glowOpacity.setValue(finalGlow);
      }
      try {
        nonTextOpacity.stopAnimation(() => {
          nonTextOpacity.setValue(shouldType ? 0 : 1);
        });
      } catch (_) {
        nonTextOpacity.setValue(shouldType ? 0 : 1);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, mode, typewriter]);

  // Keep the widget mounted once it's visible so it won't disappear if
  // a new message (or other re-render) temporarily toggles typing.
  useEffect(() => {
    if (!parsedContent.widget) {
      setWidgetMounted(false);
      return;
    }

    // If there's a widget and we're not currently typing, ensure it is mounted.
    if (!isTyping) setWidgetMounted(true);
    // If we're typing, do not unmount; we only mount once typing completes.
  }, [parsedContent.widget, isTyping]);

  const radii = useMemo(() => getRadii(mode), [mode]);
  const containerBg = useMemo(() => getContainerBackground(mode), [mode]);
  // Determine shadow color from persona gradient if provided
  const shadowColor = useMemo(
    () => (gradientColors && gradientColors.length > 0 ? gradientColors[0] : undefined),
    [gradientColors]
  );
  const containerShadow = useMemo(() => getContainerShadow(mode, shadowColor), [mode, shadowColor]);

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
  // For agent mode with widgets, use displayText (stripped of widget JSON)
  const textToDisplay = mode === "agent" && parsedContent.widget ? parsedContent.displayText : null;

  // Helper to render the text part with proper AppText styling
  const renderTextContent = (text: string | null) => {
    if (!text) return null;
    return <AppText variant="bodyText">{text}</AppText>;
  };

  const fullContent =
    // If we have a parsed text display (widget case), render it with AppText
    textToDisplay !== null ? (
      renderTextContent(textToDisplay)
    ) : React.isValidElement(children) && (children as any).type !== React.Fragment ? (
      React.cloneElement(children as any, {
        style: [(children as any).props?.style, mode === "user" ? { color: COLORS.colorWhite } : undefined],
      })
    ) : typeof children === "string" ? (
      <AppText variant="bodyText" style={mode === "user" ? { color: COLORS.colorWhite } : undefined}>
        {children}
      </AppText>
    ) : (
      // If children is a fragment/array (multiple children), do not attempt to clone the fragment
      // because React.Fragment cannot accept props like `style`. Return children as-is.
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
                colors={
                  gradientColors && gradientColors.length > 0
                    ? gradientColors
                    : [COLORS.primary1, COLORS.primary2, COLORS.primary1]
                }
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
            <View style={[styles.glow, { shadowColor: shadowColor || COLORS.primary4 }, radii]} />
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

        {/* Render widget if present (agent mode only) */}
        {mode === "agent" && parsedContent.widget && widgetMounted && (
          <Animated.View style={{ opacity: nonTextOpacity, width: "100%" }}>
            <WidgetRenderer widget={parsedContent.widget} onAction={onWidgetAction} />
          </Animated.View>
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
    padding: SPACING.md,
    alignItems: "flex-start",
    gap: SPACING.md,
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
