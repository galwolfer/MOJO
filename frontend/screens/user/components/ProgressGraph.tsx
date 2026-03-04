import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from "react-native-svg";
import { COLORS } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";

/**
 * ProgressGraph
 *
 * Displays a simple line graph showing user progress over time.
 * Uses react-native-svg to draw a smooth curved line with gradient.
 * Colors adapt based on day quality (good=green, medium=yellow, bad=red).
 *
 * Props:
 * - `data` - Array of numbers representing progress values (0-100)
 * - `dayQualities` - Array of day quality ratings ('good', 'medium', 'bad')
 * - `width` - Width of the graph
 * - `height` - Height of the graph
 */

type DayQuality = "good" | "medium" | "bad";

type ProgressGraphProps = {
  data?: number[];
  dayQualities?: DayQuality[];
  width?: number;
  height?: number;
};

// Color mapping for different day qualities
const DAY_COLORS = {
  good: "#10B981", // Green
  medium: "#F59E0B", // Yellow/Orange
  bad: "#EF4444", // Red
};

const ProgressGraph: React.FC<ProgressGraphProps> = ({
  data: propData,
  dayQualities: propQualities,
  width = 280,
  height = 100,
}) => {
  const colors = useColors();
  // Prefer real data passed via props; fallback to a sensible default for display
  const data = propData && propData.length ? propData : [20, 35, 25, 50, 45, 60, 55, 70, 65, 80, 75];

  // Auto-convert numeric data to quality labels based on thresholds
  const autoGenerateQualities = (values: number[]): DayQuality[] => {
    return values.map((value) => {
      if (value >= 67) return "good"; // 67-100 = good (green)
      if (value >= 34) return "medium"; // 34-66 = medium (yellow)
      return "bad"; // 0-33 = bad (red)
    });
  };

  // Day qualities: prefer explicit propQualities; otherwise auto-generate from numeric values
  const dayQualities = propQualities && propQualities.length ? propQualities : autoGenerateQualities(data);
  const lineStrokeWidth = 6;
  const pointRadius = 8;
  const pointStrokeWidth = 2;
  const edgePadding = Math.max(pointRadius + pointStrokeWidth / 2, lineStrokeWidth / 2);
  const padding = {
    top: edgePadding,
    bottom: edgePadding,
    left: edgePadding,
    right: edgePadding,
  };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Normalize data to graph dimensions
  const rawMax = Math.max(...data);
  const rawMin = Math.min(...data);
  const rawRange = rawMax - rawMin || 1;
  const valuePadding = Math.max(rawRange * 0.1, 4);
  const maxValue = rawMax + valuePadding;
  const minValue = rawMin - valuePadding;
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((value - minValue) / range) * graphHeight;
    const quality = dayQualities[index] || "medium";
    const color = DAY_COLORS[quality];
    return { x, y, quality, color };
  });

  // Create smooth curve path using quadratic bezier
  const createSmoothPath = () => {
    if (points.length < 2) return "";

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Control point for smooth curve
      const cpX = (current.x + next.x) / 2;

      path += ` Q ${current.x + (next.x - current.x) * 0.5} ${current.y}, ${cpX} ${(current.y + next.y) / 2}`;
    }

    // End at last point
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
  };

  // Create gradients for each segment between points
  const createSegmentGradients = () => {
    return points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const gradientId = `gradient-${index}`;

      // Check if we're jumping from red to green or green to red
      const needsYellowBridge =
        (point.quality === "good" && nextPoint.quality === "bad") ||
        (point.quality === "bad" && nextPoint.quality === "good");

      // Always include a middle Stop element; use yellow when bridging red<->green, otherwise match the start color
      const middleStop = (
        <Stop offset="50%" stopColor={needsYellowBridge ? DAY_COLORS.medium : point.color} stopOpacity={1} />
      );

      return (
        <LinearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={point.color} stopOpacity={1} />
          {middleStop}
          <Stop offset="100%" stopColor={nextPoint.color} stopOpacity={1} />
        </LinearGradient>
      );
    });
  };

  // Create path segments with individual gradients
  const createColoredSegments = () => {
    if (points.length < 2) return null;

    return points.slice(0, -1).map((current, i) => {
      const next = points[i + 1];

      // For flat lines (same y-coordinate), add a tiny offset to ensure visibility
      const currentY = current.y;
      const nextY = next.y;
      const yDiff = Math.abs(nextY - currentY);

      // If line is completely flat, create a path that's slightly curved to ensure rendering
      let path;
      if (yDiff < 0.5) {
        // Add a very subtle arc for flat lines to ensure they render
        const midX = (current.x + next.x) / 2;
        const arcY = currentY - 0.1; // Tiny bump
        path = `M ${current.x} ${currentY} Q ${midX} ${arcY} ${next.x} ${nextY}`;
      } else {
        // Normal line
        path = `M ${current.x} ${currentY} L ${next.x} ${nextY}`;
      }

      return (
        <Path
          key={`segment-${i}`}
          d={path}
          stroke={`url(#gradient-${i})`}
          strokeWidth={lineStrokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    });
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>{createSegmentGradients()}</Defs>

        {/* Colored line segments - draw BEFORE circles so circles appear on top */}
        {createColoredSegments()}

        {/* Circles for each data point */}
        {points.map((point, index) => (
          <Circle
            key={`circle-${index}`}
            cx={point.x}
            cy={point.y}
            r={pointRadius}
            fill={point.color}
            stroke={colors.bg2}
            strokeWidth={pointStrokeWidth}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProgressGraph;
