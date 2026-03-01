import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../common/AppText";
import { getTimeParts } from "../../widgets/taskHelpers";
import { SPACING, COLORS, FONT_SIZES } from "../../../theme";

interface SessionTimeProps {
  /** ISO datetime string – parsed automatically into time + AM/PM parts. */
  timeStart?: string;
  timeEnd?: string;
  /** Pre-formatted time label (e.g. "9:00 AM"). Splits AM/PM for consistent display. */
  startLabel?: string;
  endLabel?: string;
  categoryColor?: string;
}

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
  const rawStart = getTimeParts(timeStart);
  const rawEnd = getTimeParts(timeEnd);
  const labelStart = parseLabel(startLabel);
  const labelEnd = parseLabel(endLabel);

  const startTime = startLabel ? labelStart.time : rawStart.time;
  const startAmpm = startLabel ? labelStart.ampm : rawStart.ampm;
  const endTime = endLabel ? labelEnd.time : rawEnd.time;
  const endAmpm = endLabel ? labelEnd.ampm : rawEnd.ampm;
  const hasStart = !!(startLabel || timeStart);
  const hasEnd = !!(endLabel || timeEnd);

  return (
    <View style={styles.sessionTimeBlock}>
      <View style={[styles.sessionTimeLine, { backgroundColor: categoryColor || COLORS.primary1 }]} />
      <View style={styles.sessionTimeColumn}>
        <AppText variant="notes" style={styles.sessionHourText}>
          {hasStart ? (
            <>
              {startTime || "Time"}
              {startAmpm ? (
                <AppText variant="notes" style={styles.sessionAmPm}>
                  {" " + startAmpm}
                </AppText>
              ) : null}
            </>
          ) : (
            "Time"
          )}
        </AppText>
        {hasEnd ? (
          <AppText variant="notes" style={styles.sessionHourText}>
            {endTime}
            {endAmpm ? (
              <AppText variant="notes" style={styles.sessionAmPm}>
                {" " + endAmpm}
              </AppText>
            ) : null}
          </AppText>
        ) : null}
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
  sessionHourText: {
    color: COLORS.lightGray,
  },
  sessionAmPm: {
    fontSize: FONT_SIZES.sm * 0.8,
    color: COLORS.lightGray,
  },

  sessionTimeLine: {
    width: SPACING.xs,
    alignSelf: "stretch",
    borderRadius: 999,
  },
});
