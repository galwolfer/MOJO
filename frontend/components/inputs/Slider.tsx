/**
 * SliderComponent
 *
 * A highly customizable slider with:
 * - Configurable values, labels, and colors
 * - Custom descriptions for each value
 * - Flexible styling (track height, thumb size, colors)
 * - Mobile and web compatible
 */
import React, { useState } from "react";
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from "react-native";
import Slider from "@react-native-community/slider";
import AppText from "../common/AppText";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";

// Size tokens derived from theme for consistency
const THUMB_SIZE = ICON_SIZES.md; // 24-ish
const TRACK_HEIGHT = Math.round(THUMB_SIZE / 3); // ~8
const THUMB_BORDER_WIDTH = 5;
const WRAPPER_HEIGHT = THUMB_SIZE + SPACING.md * 2;

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
  trackColor = COLORS.lightGray,
  TrackThumbColor = COLORS.primary1,
  style,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const description = valueDescriptions[value] || "";

  // Calculate left offset for the description tooltip based on current value
  // Position it so the tooltip center aligns with the thumb
  const percent = max > min ? (value - min) / (max - min) : 0;
  const thumbPos = containerWidth * percent;

  return (
    <View style={[styles.container, { minHeight: WRAPPER_HEIGHT + SPACING.lg }, style]}>
      {label && (
        <AppText variant="notes" style={styles.label}>
          {label}
        </AppText>
      )}

      {/* Slider */}
      <View style={styles.sliderWrapper} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <Slider
          style={[styles.slider]}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={onValueChange}
          // Hide native visuals — we'll draw our own rounded track and thumb
          minimumTrackTintColor={"transparent"}
          maximumTrackTintColor={"transparent"}
          thumbTintColor={"transparent"}
          // Web-specific styling (via CSS)
          {...(Platform.OS === "web" && {
            style: [
              styles.slider,
              {
                height: Math.max(WRAPPER_HEIGHT + 20, 40),
                WebkitAppearance: "none",
              } as any,
            ],
          })}
        />
        {/* Custom track and thumb overlay */}
        <View style={styles.trackContainer} pointerEvents="none">
          <View
            style={[
              styles.customTrack,
              { backgroundColor: trackColor, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2 },
            ]}
          />
          <View
            style={[
              styles.customFill,
              {
                backgroundColor: TrackThumbColor,
                width: containerWidth * percent,
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
  },
  label: {
    marginBottom: SPACING.sm,
    color: COLORS.black,
    fontWeight: "600",
  },
  sliderWrapper: {
    width: "100%",
    justifyContent: "center",
    position: "relative",
    height: WRAPPER_HEIGHT,
  },
  slider: {
    width: "100%",
    height: 40,
    cursor: "pointer",
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
    borderColor: COLORS.white2,
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
