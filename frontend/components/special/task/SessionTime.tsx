import React from "react";
import { View, StyleSheet, Text } from "react-native";
import TimeDisplay from "../../common/TimeDisplay";
import { SPACING, COLORS, FONT_SIZES, FONTS } from "../../../theme";

interface SessionTimeProps {
  /** ISO datetime string – parsed automatically into time + AM/PM parts. */
  timeStart?: string;
  timeEnd?: string;
  /** Pre-formatted time label (e.g. "9:00 AM"). Splits AM/PM for consistent display. */
  startLabel?: string;
  endLabel?: string;
  categoryColor?: string;
  /** When true the session starts today but crosses midnight into the next day. */
  isOvernight?: boolean;
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
  isOvernight,
}) => {
  const hasStart = !!(timeStart || startLabel);
  const hasEnd = !!(timeEnd || endLabel);

  // Pre-parse labels only when we have no ISO string to pass to TimeDisplay directly
  const labelStart = !timeStart ? parseLabel(startLabel) : undefined;
  const labelEnd = !timeEnd ? parseLabel(endLabel) : undefined;

  // Bar always uses the category color; amber is reserved for the +1 day text label only
  const barColor = categoryColor || COLORS.primary1;

  return (
    <View style={styles.sessionTimeBlock}>
      <View style={[styles.sessionTimeLine, { backgroundColor: barColor }]} />
      <View style={styles.sessionTimeColumn}>
        {hasStart ? (
          <TimeDisplay isoString={timeStart} time={labelStart?.time} ampm={labelStart?.ampm} />
        ) : (
          <TimeDisplay time="Time" />
        )}
        <View style={styles.endTimeGroup}>
          {hasEnd ? <TimeDisplay isoString={timeEnd} time={labelEnd?.time} ampm={labelEnd?.ampm} /> : null}
          {isOvernight ? (
            <Text style={styles.overnightLabel}>🌙 +1 day</Text>
          ) : null}
        </View>
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
    alignItems: "flex-start",
    gap: SPACING.xs,
    justifyContent: "space-between",
  },
  endTimeGroup: {
    alignItems: "flex-start",
    gap: 2,
  },
  overnightLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary5,
    fontFamily: FONTS.fredokaMedium,
  },
  sessionTimeLine: {
    width: SPACING.xs,
    alignSelf: "stretch",
    borderRadius: 999,
  },
});
