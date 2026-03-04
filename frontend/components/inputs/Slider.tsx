/**
 * SliderComponent
 *
 * A highly customizable slider with:
 * - Configurable values, labels, and colors
 * - Custom descriptions for each value
 * - Flexible styling (track height, thumb size, colors)
 * - Mobile and web compatible
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";

// Size tokens derived from theme for consistency
const THUMB_SIZE = ICON_SIZES.md; // 24-ish
const TRACK_HEIGHT = Math.round(THUMB_SIZE / 3); // ~8
const THUMB_BORDER_WIDTH = 5;
const WRAPPER_HEIGHT = THUMB_SIZE + SPACING.md * 2;
const DRAG_THRESHOLD_PX = 4;

const getStepPrecision = (value: number) => {
  const valueString = value.toString();
  const decimalIndex = valueString.indexOf(".");
  return decimalIndex === -1 ? 0 : valueString.length - decimalIndex - 1;
};

type SliderComponentProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  valueDescriptions?: Record<number | string, string>; // e.g., { 1: "Not Important", 5: "Very Important" }
  trackColor?: string;
  TrackThumbColor?: string;
  style?: StyleProp<ViewStyle>;
};

const SliderComponent: React.FC<SliderComponentProps> = ({
  value,
  onValueChange,
  min = 1,
  max = 5,
  step = 1,
  label,
  valueDescriptions = {
    1: "Not Important",
    2: "Low Priority",
    3: "Moderate",
    4: "Important",
    5: "Very Important",
  },
  trackColor,
  TrackThumbColor = COLORS.primary1,
  style,
}) => {
  const colors = useColors();
  const effectiveTrackColor = trackColor ?? colors.bg2;
  const [containerWidth, setContainerWidth] = useState(0);
  const [internalValue, setInternalValue] = useState(value);
  const internalValueRef = useRef(value);
  const pressStartXRef = useRef(0);
  const lastMoveXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const stepPrecision = useMemo(() => (step > 0 ? getStepPrecision(step) : 0), [step]);

  const clampValue = useCallback((nextValue: number) => Math.min(max, Math.max(min, nextValue)), [max, min]);

  const normalizeValue = useCallback(
    (nextValue: number) => {
      const clampedValue = clampValue(nextValue);
      if (!step || step <= 0) {
        return clampedValue;
      }

      const steppedValue = Math.round((clampedValue - min) / step) * step + min;
      const roundedValue = stepPrecision > 0 ? Number(steppedValue.toFixed(stepPrecision)) : steppedValue;
      return clampValue(roundedValue);
    },
    [clampValue, min, step, stepPrecision],
  );

  const updateValue = useCallback(
    (nextValue: number) => {
      const normalizedValue = normalizeValue(nextValue);
      if (normalizedValue === internalValueRef.current) {
        return;
      }
      internalValueRef.current = normalizedValue;
      setInternalValue(normalizedValue);
      onValueChange(normalizedValue);
    },
    [normalizeValue, onValueChange],
  );

  useEffect(() => {
    const normalizedValue = normalizeValue(value);
    if (normalizedValue !== internalValueRef.current) {
      internalValueRef.current = normalizedValue;
      setInternalValue(normalizedValue);
    }
  }, [normalizeValue, value]);

  const getValueFromX = useCallback(
    (x: number) => {
      if (containerWidth <= 0 || max <= min) {
        return internalValueRef.current;
      }
      const clampedX = Math.min(Math.max(x, 0), containerWidth);
      const ratio = clampedX / containerWidth;
      return normalizeValue(min + ratio * (max - min));
    },
    [containerWidth, max, min, normalizeValue],
  );

  const getEventLocationX = useCallback((event: { nativeEvent: { locationX?: number } }) => {
    const { locationX } = event.nativeEvent;
    return typeof locationX === "number" ? locationX : null;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => containerWidth > 0,
        onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: (event) => {
          if (containerWidth <= 0) {
            return;
          }
          isDraggingRef.current = true;
          const startX = getEventLocationX(event) ?? 0;
          pressStartXRef.current = startX;
          lastMoveXRef.current = startX;
          updateValue(getValueFromX(startX));
        },
        onPanResponderMove: (event, gestureState) => {
          if (containerWidth <= 0) {
            return;
          }
          const movedDistance = Math.hypot(gestureState.dx, gestureState.dy);
          const moveX =
            getEventLocationX(event) ?? Math.min(Math.max(pressStartXRef.current + gestureState.dx, 0), containerWidth);
          lastMoveXRef.current = moveX;
          if (!isDraggingRef.current && movedDistance >= DRAG_THRESHOLD_PX) {
            isDraggingRef.current = true;
          }
          if (isDraggingRef.current) {
            updateValue(getValueFromX(moveX));
          }
        },
        onPanResponderRelease: (event, gestureState) => {
          if (containerWidth <= 0) {
            return;
          }
          const movedDistance = Math.hypot(gestureState.dx, gestureState.dy);
          if (!isDraggingRef.current || movedDistance < DRAG_THRESHOLD_PX) {
            const releaseX = getEventLocationX(event) ?? lastMoveXRef.current ?? pressStartXRef.current;
            updateValue(getValueFromX(releaseX));
          }
          isDraggingRef.current = false;
          lastMoveXRef.current = null;
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          lastMoveXRef.current = null;
        },
      }),
    [containerWidth, getEventLocationX, getValueFromX, updateValue],
  );

  const descriptionKey = step > 0 ? Number(internalValue.toFixed(stepPrecision)) : internalValue;
  const description = valueDescriptions[descriptionKey] || "";

  // Calculate left offset for the description tooltip based on current value
  // Position it so the tooltip center aligns with the thumb
  const percent = max > min ? (internalValue - min) / (max - min) : 0;
  const clampedPercent = Math.min(Math.max(percent, 0), 1);
  const thumbPos = containerWidth * clampedPercent;

  return (
    <View style={[styles.container, { minHeight: WRAPPER_HEIGHT + SPACING.lg }, style]}>
      {label && (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      )}

      {/* Slider */}
      <View
        style={[styles.sliderWrapper, Platform.OS === "web" && styles.sliderWrapperWeb]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        {...panResponder.panHandlers}
      >
        {/* Custom track and thumb overlay */}
        <View style={styles.trackContainer} pointerEvents="none">
          <View
            style={[
              styles.customTrack,
              { backgroundColor: effectiveTrackColor, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2 },
            ]}
          />
          <View
            style={[
              styles.customFill,
              {
                backgroundColor: TrackThumbColor,
                width: containerWidth * clampedPercent,
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
              },
            ]}
          />
          <View
            style={[
              styles.customThumb,
              {
                left: thumbPos - THUMB_SIZE / 2,
                top: -(THUMB_SIZE / 2) + TRACK_HEIGHT / 2,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: TrackThumbColor,
                borderWidth: THUMB_BORDER_WIDTH,
                borderColor: colors.bg2,
              },
            ]}
          />
        </View>
      </View>

      {/* Description follows the thumb */}
      <View>
        <View style={[styles.tooltip, { left: "50%", top: -10, transform: [{ translateX: "-50%" }] }]}>
          <AppText variant="notes" style={styles.description}>
            {description}
          </AppText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: SPACING.lg,
  },
  label: {
    marginBottom: -SPACING.sm,
    marginTop: SPACING.sm,
  },
  sliderWrapper: {
    width: "100%",
    justifyContent: "center",
    position: "relative",
    height: WRAPPER_HEIGHT,
  },
  sliderWrapperWeb: {
    cursor: "pointer",
    userSelect: "none",
  },
  trackContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    transform: [{ translateY: -TRACK_HEIGHT / 2 }],
    alignItems: "flex-start",
  },
  customTrack: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  customFill: {
    position: "absolute",
    left: 0,
  },
  customThumb: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: THUMB_BORDER_WIDTH,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  valueLabel: {
    fontSize: 12,
    color: COLORS.lightGray,
    fontWeight: "500",
  },
  valueLabelActive: {
    color: COLORS.primary3,
    fontWeight: "700",
  },
  tooltip: {
    position: "absolute",
    alignItems: "center",
  },
  description: {
    textAlign: "center",
    color: COLORS.lightGray,
    fontWeight: "600",
  },
});

export default SliderComponent;
