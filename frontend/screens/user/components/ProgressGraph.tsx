import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from "react-native-svg";
import { COLORS, SPACING } from "../../../theme";
import { moderateScale } from "react-native-size-matters";

/**
 * ProgressGraph
 *
 * Displays a simple line graph showing user progress over time.
 * Uses react-native-svg to draw a smooth curved line with gradient.
 *
 * Props:
 * - `data` - Array of numbers representing progress values (0-100)
 * - `width` - Width of the graph
 * - `height` - Height of the graph
 * - `color` - Primary color for the line (defaults to primary2)
 */

type ProgressGraphProps = {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
};

const ProgressGraph: React.FC<ProgressGraphProps> = ({
  data = [20, 35, 25, 50, 45, 60, 55, 70, 65, 80, 75],
  width = 280,
  height = 100,
  color = COLORS.primary2,
}) => {
  const padding = { top: 10, bottom: 10, left: 10, right: 10 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Normalize data to graph dimensions
  const maxValue = Math.max(...data, 100);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((value - minValue) / range) * graphHeight;
    return { x, y };
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

  // Create filled area path
  const createAreaPath = () => {
    const linePath = createSmoothPath();
    if (!linePath) return "";

    const last = points[points.length - 1];
    const first = points[0];
    
    return `${linePath} L ${last.x} ${height - padding.bottom} L ${first.x} ${height - padding.bottom} Z`;
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={COLORS.primary1} stopOpacity={1} />
            <Stop offset="50%" stopColor={color} stopOpacity={1} />
            <Stop offset="100%" stopColor={COLORS.primary4} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Filled area under the line */}
        <Path d={createAreaPath()} fill="url(#areaGradient)" />

        {/* Main line */}
        <Path
          d={createSmoothPath()}
          stroke="url(#lineGradient)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        {points.length > 0 && (
          <Circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={5}
            fill={COLORS.primary4}
            stroke={COLORS.white}
            strokeWidth={2}
          />
        )}
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
