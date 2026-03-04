import React from "react";
import { View, StyleSheet } from "react-native";
import TimeDisplay from "../../common/TimeDisplay";
import { SPACING, COLORS } from "../../../theme";

interface SessionTimeProps {
  /** ISO datetime string – parsed automatically into time + AM/PM parts. */
  timeStart?: string;
  timeEnd?: string;
  /** Pre-formatted time label (e.g. "9:00 AM"). Splits AM/PM for consistent display. */
  startLabel?: string;
  endLabel?: string;
  categoryColor?: string;
}

/** Split a pre-formatted label like "9:00 AM" into time + ampm parts. */
const parseLabel = (label?: string): { time: string; ampm: string } => {
  if (!label) return { time: "", ampm: "" };
  const match = label.match(/^(.+?)\s*(AM|PM)$/i);
  if (match) return { time: match[1].trim(), ampm: match[2].toUpperCase() };
  return { time: label, ampm: "" };
};

export const SessionTime: React.FC<SessionTimeProps> = ({
  timeStart,
  timeEnd,
  startLabel,
  endLabel,
  categoryColor,
}) => {
  const hasStart = !!(timeStart || startLabel);
  const hasEnd = !!(timeEnd || endLabel);

  // Pre-parse labels only when we have no ISO string to pass to TimeDisplay directly
  const labelStart = !timeStart ? parseLabel(startLabel) : undefined;
  const labelEnd = !timeEnd ? parseLabel(endLabel) : undefined;

  return (
    <View style={styles.sessionTimeBlock}>
      <View style={[styles.sessionTimeLine, { backgroundColor: categoryColor || COLORS.primary1 }]} />
      <View style={styles.sessionTimeColumn}>
        {hasStart ? (
          <TimeDisplay isoString={timeStart} time={labelStart?.time} ampm={labelStart?.ampm} />
        ) : (
          <TimeDisplay time="Time" />
        )}
        {hasEnd ? <TimeDisplay isoString={timeEnd} time={labelEnd?.time} ampm={labelEnd?.ampm} /> : null}
      </View>
    </View>
  );
};

export default SessionTime;

const styles = StyleSheet.create({
  sessionTimeBlock: {
    height: "100%",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  sessionTimeColumn: {
    alignItems: "flex-end",
    gap: SPACING.xs,
    justifyContent: "space-between",
  },
  sessionTimeLine: {
    width: SPACING.xs,
    alignSelf: "stretch",
    borderRadius: 999,
  },
});
