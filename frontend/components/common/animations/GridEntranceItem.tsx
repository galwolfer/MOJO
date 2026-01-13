/**
 * GridEntranceItem
 *
 * Reusable grid item entrance animation modeled after CategoryGrid.
 * Staggers scale/opacity so items "form" across the grid.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, View, ViewStyle } from "react-native";

export const DEFAULT_GRID_ENTRANCE = {
  enabled: false,
  baseDelay: 120,
  stagger: 80,
  duration: 300,
};

type GridEntranceItemProps = {
  id: string;
  rowIndex: number;
  colIndex: number;
  enabled?: boolean;
  skipAnimation?: boolean;
  hideUntilEnabled?: boolean;
  animateHeight?: boolean;
  baseDelay?: number;
  stagger?: number;
  duration?: number;
  animatedSetRef?: React.MutableRefObject<Set<string>>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const GridEntranceItem: React.FC<GridEntranceItemProps> = ({
  id,
  rowIndex,
  colIndex,
  enabled = false,
  skipAnimation = false,
  hideUntilEnabled = false,
  animateHeight = false,
  baseDelay = DEFAULT_GRID_ENTRANCE.baseDelay,
  stagger = DEFAULT_GRID_ENTRANCE.stagger,
  duration = DEFAULT_GRID_ENTRANCE.duration,
  animatedSetRef,
  style,
  children,
}) => {
  const hasAnimated = animatedSetRef?.current?.has(id) ?? false;
  const shouldHide = hideUntilEnabled && !enabled && !skipAnimation && !hasAnimated;
  const initialScale = skipAnimation || !enabled || hasAnimated ? 1 : 0.8;
  const scale = useRef(new Animated.Value(shouldHide ? 1 : initialScale)).current;
  const opacity = useRef(new Animated.Value(shouldHide ? 0 : skipAnimation || !enabled || hasAnimated ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const height = useRef(new Animated.Value(shouldHide ? 0 : contentHeight || 0)).current;

  useEffect(() => {
    if (skipAnimation || !enabled) {
      scale.setValue(1);
      opacity.setValue(shouldHide ? 0 : 1);
      if (animateHeight && contentHeight != null) {
        height.setValue(shouldHide ? 0 : contentHeight);
      }
      return;
    }

    if (hasAnimated) {
      scale.setValue(1);
      opacity.setValue(1);
      if (animateHeight && contentHeight != null) {
        height.setValue(contentHeight);
      }
      return;
    }

    if (animateHeight && contentHeight == null) return;

    const delay = baseDelay + (rowIndex + colIndex) * stagger;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: Math.max(120, duration - 50),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        ...(animateHeight && contentHeight != null
          ? [
              Animated.timing(height, {
                toValue: contentHeight,
                duration: Math.max(180, duration + 60),
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
              }),
            ]
          : []),
      ]),
      Animated.timing(scale, {
        toValue: 1.05,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start(() => {
      if (animatedSetRef) animatedSetRef.current.add(id);
    });
  }, [
    skipAnimation,
    enabled,
    hasAnimated,
    shouldHide,
    animateHeight,
    contentHeight,
    baseDelay,
    stagger,
    duration,
    rowIndex,
    colIndex,
    scale,
    opacity,
    id,
    animatedSetRef,
  ]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ scale }],
          height: animateHeight && contentHeight != null ? height : undefined,
          overflow: animateHeight ? "hidden" : "visible",
        },
      ]}
    >
      <View
        onLayout={(event) => {
          if (!animateHeight) return;
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          if (contentHeight == null && nextHeight > 0) {
            setContentHeight(nextHeight);
            if (shouldHide) height.setValue(0);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
};

export default GridEntranceItem;
