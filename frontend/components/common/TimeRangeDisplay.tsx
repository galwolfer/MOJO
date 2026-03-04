/**
 * TimeRangeDisplay
 *
 * Renders a time range (start - end) using TimeDisplay for each time,
 * respecting the user's global time format preference.
 *
 * - Both times use the "notes" size and `colors.gray1`
 * - 24h mode: "14:30 - 15:30"
 * - 12h mode: "2:30 AM - 3:30 PM" (times at notes size, AM/PM smaller)
 */

import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, useWindowDimensions } from "react-native";
import TimeDisplay from "./TimeDisplay";

export interface TimeRangeDisplayProps {
  /** ISO datetime string for start time */
  startIsoString?: string;
  /** ISO datetime string for end time */
  endIsoString?: string;
  /** Optional extra styles applied to the outer View */
  style?: StyleProp<ViewStyle>;
}

const TimeRangeDisplay: React.FC<TimeRangeDisplayProps> = ({ startIsoString, endIsoString, style }) => {
  const { width } = useWindowDimensions();
  const twoLine = width < 500;

  if (twoLine) {
    return (
      <View style={[styles.container, styles.twoLine, style]}>
        <View style={styles.row}>
          <TimeDisplay isoString={startIsoString} />
          <TimeDisplay time="-" />
        </View>
        <View style={styles.row}>
          <TimeDisplay isoString={endIsoString} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TimeDisplay isoString={startIsoString} />
      <TimeDisplay time="-" />
      <TimeDisplay isoString={endIsoString} />
    </View>
  );
};

export default TimeRangeDisplay;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  twoLine: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
