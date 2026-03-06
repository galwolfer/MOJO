/**
 * WeeklyScheduleEditor
 *
 * Reusable weekly busy-time editor.
 * Each day card is a self-contained BusyBlock configuration:
 *   • toggle to enable/disable
 *   • optional title
 *   • one or more From→To time ranges (all stored in one BusyBlock's times[])
 *
 * When saved, each enabled day produces ONE BusyBlock record:
 *   { blockType: "WEEKLY", daysOfWeek: [dayIndex], title, times: [{startTime, endTime}, …] }
 *
 * Exports:
 *   Types      — TimeRange, DaySchedule, DayKey, WeeklySchedule
 *   Constants  — DAY_KEYS, DAY_LABELS, DAY_INDEX
 *   Helpers    — emptySchedule(), validateSchedule()
 *   Components — WeeklyScheduleEditor (default export), DayBlockEditor
 */
import React from "react";
import { View, Switch, Pressable, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import Input from "../inputs/Input";
import Icon from "../icons/Icon";
import { TimeRangePicker } from "../inputs/TimeRangePicker";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface TimeRange {
  /** 24-hour HH:MM e.g. "09:00" */
  start: string;
  /** 24-hour HH:MM e.g. "10:00" */
  end: string;
}

export interface DayBlock {
  /** Optional label for this specific time slot */
  title: string;
  /** The start/end window — one entry in the BusyBlock's times[] array */
  range: TimeRange;
}

export interface DaySchedule {
  enabled: boolean;
  /** Each block = one time slot; all blocks become times[] in the single BusyBlock for this day */
  blocks: DayBlock[];
}

export type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type WeeklySchedule = Record<DayKey, DaySchedule>;

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

export const DAY_KEYS: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const DAY_LABELS: Record<DayKey, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

/** Maps each DayKey → JS Date.getDay() / MongoDB daysOfWeek index (0 = Sunday) */
export const DAY_INDEX: Record<DayKey, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Return a WeeklySchedule with all days disabled. */
export function emptySchedule(): WeeklySchedule {
  const s = {} as WeeklySchedule;
  DAY_KEYS.forEach((k) => {
    s[k] = { enabled: false, blocks: [] };
  });
  return s;
}

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Validate the schedule.
 * Returns an error string, or null when valid.
 * At least one day must be enabled; each enabled day needs ≥ 1 valid,
 * non-overlapping range.
 */
export function validateSchedule(schedule: WeeklySchedule): string | null {
  const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
  let anyEnabled = false;

  for (const key of DAY_KEYS) {
    const day = schedule[key];
    if (!day.enabled) continue;
    anyEnabled = true;

    if (day.blocks.length === 0) {
      return `${DAY_LABELS[key]} is enabled but has no time ranges — add one or disable the day.`;
    }

    for (let i = 0; i < day.blocks.length; i++) {
      const { start, end } = day.blocks[i].range;
      if (!HH_MM.test(start))
        return `${DAY_LABELS[key]} range ${i + 1}: invalid start time "${start}" — use HH:MM`;
      if (!HH_MM.test(end))
        return `${DAY_LABELS[key]} range ${i + 1}: invalid end time "${end}" — use HH:MM`;
      if (toMins(end) <= toMins(start))
        return `${DAY_LABELS[key]} range ${i + 1}: end time must be after start time`;
    }

    // Overlap check
    const sorted = [...day.blocks].sort((a, b) => toMins(a.range.start) - toMins(b.range.start));
    for (let i = 1; i < sorted.length; i++) {
      if (toMins(sorted[i].range.start) < toMins(sorted[i - 1].range.end)) {
        return `${DAY_LABELS[key]}: time ranges overlap`;
      }
    }
  }

  if (!anyEnabled) return "Enable at least one day of the week";
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// BlockEntryCard — one titled time-slot card inside a day
// ──────────────────────────────────────────────────────────────────────────────

interface BlockEntryCardProps {
  block: DayBlock;
  onChange: (b: DayBlock) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function BlockEntryCard({ block, onChange, onRemove, canRemove }: BlockEntryCardProps) {
  return (
    <View style={bcStyles.card}>
      <TimeRangePicker
        startTime={block.range.start}
        endTime={block.range.end}
        onStartChange={(v) => onChange({ ...block, range: { ...block.range, start: v } })}
        onEndChange={(v) => onChange({ ...block, range: { ...block.range, end: v } })}
        color="primary1"
      />
      {canRemove && (
        <Pressable style={bcStyles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Icon name="cancel" size={16} color="#C62828" />
        </Pressable>
      )}
    </View>
  );
}

const bcStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.primary1 + "33",
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary1 + "08",
    gap: SPACING.sm,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// DayBlockEditor
// ──────────────────────────────────────────────────────────────────────────────

export interface DayBlockEditorProps {
  dayKey: DayKey;
  schedule: DaySchedule;
  onChange: (s: DaySchedule) => void;
}

/**
 * One day card — toggle + (when enabled) stacked block entries.
 * Each DaySchedule maps to ONE BusyBlock record on save, with all
 * time slots packed into its times[] array.
 */
export function DayBlockEditor({ dayKey, schedule, onChange }: DayBlockEditorProps) {
  const { enabled, blocks } = schedule;

  const emptyBlock = (): DayBlock => ({ title: "", range: { start: "09:00", end: "10:00" } });

  const toggleDay = () => {
    if (!enabled) {
      onChange({
        ...schedule,
        enabled: true,
        blocks: blocks.length ? blocks : [emptyBlock()],
      });
    } else {
      onChange({ ...schedule, enabled: false });
    }
  };

  const updateBlock = (i: number, b: DayBlock) => {
    const next = [...blocks];
    next[i] = b;
    onChange({ ...schedule, blocks: next });
  };

  const removeBlock = (i: number) =>
    onChange({ ...schedule, blocks: blocks.filter((_, idx) => idx !== i) });

  const addBlock = () =>
    onChange({ ...schedule, blocks: [...blocks, emptyBlock()] });

  return (
    <View style={[dayStyles.card, enabled && dayStyles.cardEnabled]}>
      {/* Header: day name + toggle */}
      <View style={dayStyles.header}>
        <View style={dayStyles.dayNameRow}>
          {enabled && <View style={dayStyles.activeDot} />}
          <AppText style={[dayStyles.dayName, enabled && dayStyles.dayNameEnabled]}>
            {DAY_LABELS[dayKey]}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggleDay}
          trackColor={{ false: COLORS.white3, true: COLORS.primary1 }}
          thumbColor={COLORS.colorWhite}
          ios_backgroundColor={COLORS.white3}
          style={dayStyles.switchScale}
        />
      </View>

      {/* Divider + block entries — only shown when enabled */}
      {enabled && (
        <View style={dayStyles.body}>
          <View style={dayStyles.divider} />
          {blocks.map((b, i) => (
            <BlockEntryCard
              key={i}
              block={b}
              onChange={(nb) => updateBlock(i, nb)}
              onRemove={() => removeBlock(i)}
              canRemove={blocks.length > 1}
            />
          ))}

          <AppButton
            title="+ Add Time Slot"
            mode="light"
            color="primary1"
            onPress={addBlock}
            width="100%"
          />
        </View>
      )}
    </View>
  );
}

const dayStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.white3,
    ...SHADOWS.card,
  },
  cardEnabled: {
    borderColor: COLORS.primary1 + "55",
    backgroundColor: COLORS.colorWhite,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary1,
  },
  dayName: {
    fontSize: FONT_SIZES.base,
    fontWeight: "500",
    color: COLORS.lightGray,
  },
  dayNameEnabled: {
    color: COLORS.primary1,
    fontWeight: "500",
    fontSize: FONT_SIZES.md,
  },
  switchScale: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.primary1 + "22",
    marginBottom: SPACING.md,
    borderRadius: 1,
  },
  body: {
    marginTop: SPACING.sm,
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// WeeklyScheduleEditor — default export
// ──────────────────────────────────────────────────────────────────────────────

export interface WeeklyScheduleEditorProps {
  schedule: WeeklySchedule;
  onChange: (s: WeeklySchedule) => void;
}

export default function WeeklyScheduleEditor({
  schedule,
  onChange,
}: WeeklyScheduleEditorProps) {
  const updateDay = (key: DayKey, day: DaySchedule) =>
    onChange({ ...schedule, [key]: day });

  return (
    <View style={{ width: "100%", paddingTop: SPACING.sm }}>
      {DAY_KEYS.map((key) => (
        <DayBlockEditor
          key={key}
          dayKey={key}
          schedule={schedule[key]}
          onChange={(s) => updateDay(key, s)}
        />
      ))}
    </View>
  );
}
