import React from "react";
import { Animated, Easing, View } from "react-native";
import { SPACING } from "../../../theme";

/**
 * AnimatedButtonsContainer
 *
 * A compact, reusable container to animate groups of buttons or other action
 * elements. Supports:
 * - Container entrance animation (fade + translateY)
 * - Optional vertical or horizontal layout
 * - Per-child staggered entrance (opacity + translateY)
 * - Tunable spacing and delays via props (`gap`, `paddingTop`, `paddingBottom`, `containerDelay`, `staggerDelay`)
 *
 * Usage:
 * ```tsx
 * <AnimatedButtonsContainer entranceEnabled={typingDone} vertical staggerChildren>
 *   <AppButton title="Primary" width="100%" color="primary6" />
 *   <AppButton title="Secondary" mode="light" width="100%" />
 * </AnimatedButtonsContainer>
 * ```
 */
interface Props {
  children: React.ReactNode;
  entranceEnabled: boolean;
  gap?: number;
  paddingTop?: number;
  paddingBottom?: number;
  vertical?: boolean;
  staggerChildren?: boolean;
  staggerDelay?: number;
  containerDelay?: number;
}

const AnimatedButtonsContainer: React.FC<Props> = ({
  children,
  entranceEnabled,
  gap = SPACING.md,
  paddingTop = 0,
  paddingBottom = SPACING.lg,
  vertical = false,
  staggerChildren = false,
  staggerDelay = 100,
  containerDelay = 100,
}) => {
  const opacityRef = React.useRef(new Animated.Value(entranceEnabled ? 0 : 1));
  const translateYRef = React.useRef(new Animated.Value(entranceEnabled ? 8 : 0));
  // Track if this is the first time showing the entrance animation
  const isFirstEntranceRef = React.useRef(true);

  const childArray = React.Children.toArray(children);
  const childAnimsRef = React.useRef<
    {
      opacity: Animated.Value;
      translateY: Animated.Value;
    }[]
  >([]);

  React.useEffect(() => {
    if (!entranceEnabled) return;

    // Skip animation if this is not the first entrance (e.g., returning from navigation)
    if (!isFirstEntranceRef.current) {
      opacityRef.current.setValue(1);
      translateYRef.current.setValue(0);
      childAnimsRef.current.forEach(({ opacity, translateY }) => {
        opacity.setValue(1);
        translateY.setValue(0);
      });
      return;
    }

    // Mark that we've done the animation at least once
    isFirstEntranceRef.current = false;

    const containerAnim = Animated.parallel([
      Animated.timing(opacityRef.current, {
        toValue: 1,
        duration: 200,
        delay: containerDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(translateYRef.current, {
        toValue: 0,
        duration: 200,
        delay: containerDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    // If no stagger requested, just run container animation
    if (!staggerChildren || childArray.length === 0) {
      containerAnim.start();
      return;
    }

    // Initialize per-child animated values if needed
    if (childAnimsRef.current.length !== childArray.length) {
      childAnimsRef.current = childArray.map(() => ({
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(8),
      }));
    }

    const childAnims = childAnimsRef.current.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );

    Animated.sequence([containerAnim, Animated.stagger(staggerDelay, childAnims)]).start();
  }, [entranceEnabled, staggerChildren, staggerDelay, childArray.length]);

  return (
    <Animated.View
      style={{
        width: "100%",
        alignItems: "center",
        opacity: opacityRef.current,
        transform: [{ translateY: translateYRef.current }],
      }}
    >
      <View
        style={{
          width: "100%",
          flexDirection: vertical ? "column" : "row",
          justifyContent: vertical ? "flex-start" : "center",
          alignItems: "center",
          gap,
          paddingTop,
          paddingBottom,
        }}
      >
        {childArray.map((child, i) => {
          const anim = childAnimsRef.current[i];
          if (!staggerChildren || !anim) return <React.Fragment key={i}>{child}</React.Fragment>;

          return (
            <Animated.View
              key={i}
              style={{ opacity: anim.opacity, transform: [{ translateY: anim.translateY }], width: "100%" }}
            >
              {child}
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
};

export default AnimatedButtonsContainer;
