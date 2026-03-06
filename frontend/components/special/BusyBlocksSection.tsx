/**
 * BusyBlocksSection
 *
 * Two boxes rendered at the bottom of EditPreferences:
 *
 * 1. "Gap Between Tasks" — compact stepper (−/+) that persists minGapMinutes.
 * 2. "Busy Blocks" — weekly availability editor: one toggle + multiple time ranges
 *    per day of week, with Add / Edit (popup form) and Delete (confirmation popup) actions.
 *
 * The popup uses WeeklyScheduleEditor to let the user enable days and define
 * one or more From→To time ranges per day.  On save it creates ONE WEEKLY
 * BusyBlock per enabled day, with all time slots packed into that block's times[].
 *
 * Sub-components:
 *   WeeklyScheduleEditor (external), TitleField,
 *   BlockFormButtons, BlockItem, GapBox, BlocksBox
 *
 * All error and confirmation dialogs use PopupBox — no native Alert calls.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import Input from "../inputs/Input";
import InputField from "../inputs/InputField";
import Icon from "../icons/Icon";
import CalendarPicker from "../inputs/CalendarPicker";
import Box from "../layout/Box";
import PopupBox from "../common/PopupBox";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { ICONS } from "../icons/icons";
import {
  listBusyBlocks,
  createBusyBlock,
  deleteBusyBlock,
  type BusyBlock,
  type BusyBlockType,
  type CreateBusyBlockPayload,
} from "../../services/busyBlockService";
import {
  getSchedulingPreferences,
  updateSchedulingPreferences,
} from "../../services/apiClient";
import WeeklyScheduleEditor, {
  type WeeklySchedule,
  type DayKey,
  type TimeRange,
  DAY_KEYS,
  DAY_INDEX,
  emptySchedule,
  validateSchedule,
} from "./WeeklyScheduleEditor";

// ──────────────────────────────────────────────────────────────────────────────
// Domain helpers (pure — no React)
// ──────────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BLOCK_TYPE_LABELS: Record<BusyBlockType, string> = {
  DAILY:    "Every day",
  WEEKLY:   "Weekly",
  ONCE:     "Specific date",
};

function isoToDatePart(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

function isoToTimePart(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  } catch { return "00:00"; }
}

/**
 * Human-readable summary for a block row.
 * New-style: derived from blockType + new fields.
 * Legacy: derived from start/end times.
 */
function blockSummary(block: BusyBlock): string {
  if (block.blockType === "ONCE") {
    const dateStr = block.date ? new Date(block.date).toISOString().slice(0, 10) : "";
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `${dateStr} ∣ ${timesStr}` : dateStr || "Once";
  }
  if (block.blockType === "WEEKLY") {
    if (block.weeklySchedule?.length) {
      return block.weeklySchedule
        .map((e) => {
          const t = (e.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
          return `${DAY_LABELS[e.dayOfWeek]} ∣ ${t}`;
        })
        .join("\n");
    }
    const days = (block.daysOfWeek ?? []).map((d) => DAY_LABELS[d]).join(", ");
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `${days} ∣ ${timesStr}` : days || "Weekly";
  }
  if (block.blockType === "DAILY") {
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `Every day ∣ ${timesStr}` : "Every day";
  }
  // Legacy
  if (block.start && block.end) {
    return `${isoToTimePart(block.start)} – ${isoToTimePart(block.end)}`;
  }
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Form state types & helpers
// ──────────────────────────────────────────────────────────────────────────────

interface BlockFormState {
  blockType: BusyBlockType;
  title: string;
  /** WEEKLY — per-day schedule */
  schedule: WeeklySchedule;
  /** DAILY / ONCE — one or more time windows */
  timeRanges: TimeRange[];
  /** ONCE — target date (YYYY-MM-DD) */
  onceDate: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyBlockForm(): BlockFormState {
  return {
    blockType: "WEEKLY",
    title: "",
    schedule: emptySchedule(),
    timeRanges: [{ start: "09:00", end: "10:00" }],
    onceDate: todayISO(),
  };
}

/** Convert a stored BusyBlock → BlockFormState for editing. */
function blockToFormState(block: BusyBlock): BlockFormState {
  const base = emptyBlockForm();
  base.title = block.title ?? "";
  const bt = block.blockType ?? "WEEKLY";
  base.blockType = bt;

  const firstStart = block.times?.[0]?.startTime ?? (block.start ? isoToTimePart(block.start) : "09:00");
  const firstEnd   = block.times?.[0]?.endTime   ?? (block.end   ? isoToTimePart(block.end)   : "10:00");

  if (bt === "WEEKLY") {
    const schedule = emptySchedule();
    if (block.weeklySchedule?.length) {
      // New-style: restore per-day times from weeklySchedule
      block.weeklySchedule.forEach((entry) => {
        const key = DAY_KEYS[entry.dayOfWeek];
        if (key) {
          schedule[key] = {
            enabled: true,
            blocks: (entry.times ?? []).map((t) => ({
              title: "",
              range: { start: t.startTime, end: t.endTime },
            })),
          };
        }
      });
    } else {
      // Legacy: all days share the same times
      const restoredBlocks = (block.times?.length
        ? block.times
        : [{ startTime: firstStart, endTime: firstEnd }]
      ).map((t) => ({ title: block.title ?? "", range: { start: t.startTime, end: t.endTime } }));
      (block.daysOfWeek ?? []).forEach((idx) => {
        const key = DAY_KEYS[idx];
        if (key) schedule[key] = { enabled: true, blocks: restoredBlocks };
      });
    }
    base.schedule = schedule;
  } else if (bt === "DAILY") {
    base.timeRanges = (block.times?.length ? block.times : [{ startTime: firstStart, endTime: firstEnd }])
      .map((t) => ({ start: t.startTime, end: t.endTime }));
  } else if (bt === "ONCE") {
    base.onceDate = block.date ? new Date(block.date).toISOString().slice(0, 10) : todayISO();
    base.timeRanges = (block.times?.length ? block.times : [{ startTime: firstStart, endTime: firstEnd }])
      .map((t) => ({ start: t.startTime, end: t.endTime }));
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

// ── DatePickerField ───────────────────────────────────────────────────────────
interface DatePickerFieldProps {
  value: string;
  onSelect: (d: string) => void;
  label?: string;
}

function DatePickerField({ value, onSelect, label = "Date" }: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (d: string) => {
    onSelect(d);
    setOpen(false);
  };

  return (
    <View style={{ marginTop: SPACING.sm }}>
      {label ? <AppText style={formStyles.fieldLabel}>{label}</AppText> : null}
      <Pressable style={dpStyles.trigger} onPress={() => setOpen((v) => !v)}>
        <AppText style={[dpStyles.dateText, !value && dpStyles.placeholder]}>
          {value || "Select a date"}
        </AppText>
        <View style={[dpStyles.iconBtn, open && dpStyles.iconBtnActive]}>
          {ICONS.calendar
            ? React.createElement(ICONS.calendar, { size: 16, color: open ? COLORS.white : COLORS.primary1 })
            : null}
        </View>
      </Pressable>
      {open && (
        <View style={dpStyles.calendarWrap}>
          <CalendarPicker
            selectedDate={value}
            onDateSelect={handleSelect}
            allowPastDates={false}
          />
        </View>
      )}
    </View>
  );
}

const dpStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.colorWhite,
    gap: SPACING.sm,
  },
  dateText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "500",
  },
  placeholder: {
    color: COLORS.lightGray,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.colorWhite,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnActive: {
    backgroundColor: COLORS.primary1,
    borderColor: COLORS.primary1,
  },
  calendarWrap: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.white3,
    borderRadius: 12,
    overflow: "hidden",
  },
});

// ── TimeRangesEditor — shared by DAILY and ONCE ───────────────────────────────
interface TimeRangesEditorProps {
  ranges: TimeRange[];
  onChange: (r: TimeRange[]) => void;
}

function TimeRangesEditor({ ranges, onChange }: TimeRangesEditorProps) {
  const add = () => onChange([...ranges, { start: "09:00", end: "10:00" }]);
  const remove = (i: number) => onChange(ranges.filter((_, idx) => idx !== i));
  const update = (i: number, r: TimeRange) => {
    const next = [...ranges];
    next[i] = r;
    onChange(next);
  };

  return (
    <View style={{ marginTop: SPACING.md }}>
      <AppText style={formStyles.fieldLabel}>Time Range(s)</AppText>
      {ranges.map((r, i) => (
        <View key={i} style={trStyles.row}>
          <AppText style={trStyles.label}>From</AppText>
          <View style={trStyles.inputWrap}>
            <InputField
              value={r.start}
              onChangeText={(v) => update(i, { ...r, start: v })}
              placeholderText="09:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              selectTextOnFocus
            />
          </View>
          <AppText style={trStyles.label}>To</AppText>
          <View style={trStyles.inputWrap}>
            <InputField
              value={r.end}
              onChangeText={(v) => update(i, { ...r, end: v })}
              placeholderText="10:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              selectTextOnFocus
            />
          </View>
          {ranges.length > 1 && (
            <Pressable style={trStyles.removeBtn} onPress={() => remove(i)} hitSlop={8}>
              <Icon name="cancel" size={16} color="#C62828" />
            </Pressable>
          )}
        </View>
      ))}
      <AppButton
        title="+ Add Time Range"
        mode="light"
        color="primary1"
        onPress={add}
        width="100%"
        style={{ marginTop: SPACING.sm }}
      />
    </View>
  );
}

const trStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.darkGray, minWidth: 30 },
  inputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.white3,
    borderRadius: 8,
    backgroundColor: COLORS.colorWhite,
    overflow: "hidden",
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
  },
});

// ── FullDayForm — one-time date OR recurring weekday picker ───────────────────
interface FullDayFormProps {
  mode: "date" | "recurring";
  date: string;
  days: number[];
  onChangeMode: (m: "date" | "recurring") => void;
  onChangeDate: (v: string) => void;
  onChangeDays: (v: number[]) => void;
}

const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function FullDayForm({ mode, date, days, onChangeMode, onChangeDate, onChangeDays }: FullDayFormProps) {
  const toggleDay = (idx: number) => {
    onChangeDays(
      days.includes(idx) ? days.filter((d) => d !== idx) : [...days, idx]
    );
  };

  return (
    <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
      {/* Mode toggle */}
      <View style={formStyles.chipRow}>
        <Pressable
          style={[formStyles.chip, mode === "date" && formStyles.chipActive]}
          onPress={() => onChangeMode("date")}
        >
          <AppText style={[formStyles.chipText, mode === "date" && formStyles.chipTextActive]}>
            Specific Date
          </AppText>
        </Pressable>
        <Pressable
          style={[formStyles.chip, mode === "recurring" && formStyles.chipActive]}
          onPress={() => onChangeMode("recurring")}
        >
          <AppText style={[formStyles.chipText, mode === "recurring" && formStyles.chipTextActive]}>
            Every Week
          </AppText>
        </Pressable>
      </View>

      {mode === "date" && (
        <DatePickerField
          value={date}
          onSelect={onChangeDate}
        />
      )}

      {mode === "recurring" && (
        <>
          <AppText style={formStyles.fieldLabel}>Days of Week</AppText>
          <View style={formStyles.dayRow}>
            {WEEK_LABELS.map((lbl, idx) => (
              <Pressable
                key={idx}
                style={[formStyles.dayCircle, days.includes(idx) && formStyles.dayCircleActive]}
                onPress={() => toggleDay(idx)}
              >
                <AppText style={[formStyles.dayText, days.includes(idx) && formStyles.dayTextActive]}>
                  {lbl}
                </AppText>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}


const formStyles = StyleSheet.create({
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: 4,
    fontWeight: "400",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary1,
  },
  chipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary1,
    fontWeight: "500",
  },
  chipTextActive: {
    color: COLORS.white,
  },
  dayRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCircleActive: {
    backgroundColor: COLORS.primary1,
  },
  dayText: {
    fontSize: 11,
    color: COLORS.primary1,
    fontWeight: "600",
  },
  dayTextActive: {
    color: COLORS.white,
  },
});

// ── BlockFormButtons ──────────────────────────────────────────────────────────
interface BlockFormButtonsProps {
  isEditing: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function BlockFormButtons({ isEditing, saving, onCancel, onSubmit }: BlockFormButtonsProps) {
  return (
    <View style={blockFormBtnStyles.row}>
      <AppButton
        title="Discard"
        mode="light"
        color="lightGray"
        onPress={onCancel}
        width="48%"
        disabled={saving}
      />
      <AppButton
        title={saving ? "Saving…" : isEditing ? "Save Changes" : "Save"}
        mode="filled"
        color="primary1"
        onPress={onSubmit}
        width="48%"
        disabled={saving}
      />
    </View>
  );
}

const blockFormBtnStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
  },
});

// ── BlockItem ─────────────────────────────────────────────────────────────────
interface BlockItemProps {
  block: BusyBlock;
  onEdit: (block: BusyBlock) => void;
  onDelete: (block: BusyBlock) => void;
}

function BlockItem({ block, onEdit, onDelete }: BlockItemProps) {
  const typeLabel = block.blockType ? BLOCK_TYPE_LABELS[block.blockType] : null;
  const summary = blockSummary(block);

  return (
    <View style={blockItemStyles.container}>
      <View style={blockItemStyles.info}>
        {block.title ? (
          <AppText style={blockItemStyles.title}>{block.title}</AppText>
        ) : null}
        {typeLabel ? (
          <AppText style={blockItemStyles.typeLabel}>{typeLabel}</AppText>
        ) : null}
        <AppText style={blockItemStyles.timeRange}>{summary}</AppText>
      </View>
      <View style={blockItemStyles.actions}>
        <Pressable
          style={[blockItemStyles.iconBtn, { backgroundColor: COLORS.white2 ?? "#F0F0F8" }]}
          onPress={() => onEdit(block)}
        >
          {ICONS.edit ? React.createElement(ICONS.edit, { size: 15, color: COLORS.primary1 }) : null}
        </Pressable>
        <Pressable
          style={[blockItemStyles.iconBtn, { backgroundColor: "#FFEBEE" }]}
          onPress={() => onDelete(block)}
        >
          {ICONS.trash ? React.createElement(ICONS.trash, { size: 15, color: "#C62828" }) : null}
        </Pressable>
      </View>
    </View>
  );
}

const blockItemStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary1,
    ...SHADOWS.card,
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: FONT_SIZES.sm, fontWeight: "600", color: COLORS.darkGray },
  timeRange: { fontSize: FONT_SIZES.sm, color: COLORS.darkGray },
  typeLabel: { fontSize: FONT_SIZES.sm, color: COLORS.primary1, fontWeight: "600" as const, textTransform: "uppercase" as const },
  actions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ── GapBox ────────────────────────────────────────────────────────────────────
interface GapBoxProps {
  gapMinutes: number;
  saving: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onSave: () => void;
}

function GapBox({ gapMinutes, saving, onDecrement, onIncrement, onSave }: GapBoxProps) {
  return (
    <Box title="GAP BETWEEN TASKS" titleColor={COLORS.primary1} style={gapBoxStyles.box}>
      <AppText style={gapBoxStyles.helpText}>
        Minimum minutes of free time between two scheduled sessions.
      </AppText>
      <View style={gapBoxStyles.row}>
        <Pressable style={gapBoxStyles.stepBtn} onPress={onDecrement}>
          <AppText style={gapBoxStyles.stepText}>−</AppText>
        </Pressable>
        <AppText style={gapBoxStyles.value}>{gapMinutes} min</AppText>
        <Pressable style={gapBoxStyles.stepBtn} onPress={onIncrement}>
          <AppText style={gapBoxStyles.stepText}>+</AppText>
        </Pressable>
        <AppButton
          title={saving ? "…" : "Save"}
          mode="filled"
          color="primary6"
          onPress={onSave}
          disabled={saving}
          style={gapBoxStyles.saveBtn}
        />
      </View>
    </Box>
  );
}

const gapBoxStyles = StyleSheet.create({
  box: { width: "100%" },
  helpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: SPACING.md,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.base,
    fontWeight: "700",
    lineHeight: FONT_SIZES.base * 1.2,
  },
  value: {
    flex: 1,
    textAlign: "center",
    fontSize: FONT_SIZES.base,
    fontWeight: "600",
    color: COLORS.primary1,
  },
  saveBtn: { flex: 1 },
});

// ── BlocksBox ─────────────────────────────────────────────────────────────────
interface BlocksBoxProps {
  blocks: BusyBlock[];
  loading: boolean;
  onEdit: (block: BusyBlock) => void;
  onDelete: (block: BusyBlock) => void;
  onAdd: () => void;
}

function BlocksBox({ blocks, loading, onEdit, onDelete, onAdd }: BlocksBoxProps) {
  return (
    <Box title="BUSY BLOCKS" titleColor={COLORS.primary1} style={blocksBoxStyles.box}>
      <AppText style={blocksBoxStyles.helpText}>
        Mark when you're unavailable. Mojo won't schedule tasks during these windows.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary1} style={{ marginVertical: SPACING.lg }} />
      ) : (
        <>
          {blocks.length === 0 ? (
            <AppText style={blocksBoxStyles.emptyText}>No busy blocks yet.</AppText>
          ) : (
            <View style={blocksBoxStyles.list}>
              {blocks.map((block) => (
                <BlockItem
                  key={block._id}
                  block={block}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </View>
          )}
          <AppButton
            title="+ Add Busy Block"
            mode="light"
            color="primary1"
            onPress={onAdd}
            width="100%"
            style={{ alignSelf: "stretch" }}
          />
        </>
      )}
    </Box>
  );
}

const blocksBoxStyles = StyleSheet.create({
  box: { width: "100%" },
  helpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: SPACING.md,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    textAlign: "center",
    marginVertical: SPACING.md,
  },
  list: { gap: SPACING.sm, marginBottom: SPACING.md },
});

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export default function BusyBlocksSection({ style }: { style?: ViewStyle }) {
  const [blocks, setBlocks] = useState<BusyBlock[]>([]);
  const [loading, setLoading] = useState(true);

  // Gap preference
  const [gapMinutes, setGapMinutes] = useState(10);
  const [savingGap, setSavingGap] = useState(false);

  // Add / Edit form popup
  const [formVisible, setFormVisible] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BusyBlock | null>(null);
  const [form, setForm] = useState<BlockFormState>(emptyBlockForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation popup
  const [confirmDelete, setConfirmDelete] = useState<BusyBlock | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generic error popup
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Load data on mount ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedBlocks, prefs] = await Promise.all([
        listBusyBlocks(),
        getSchedulingPreferences(),
      ]);
      setBlocks(fetchedBlocks);
      setGapMinutes(prefs?.minGapMinutes ?? 10);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Gap preference ────────────────────────────────────────────────────────
  const handleSaveGap = async () => {
    setSavingGap(true);
    try {
      const saved = await updateSchedulingPreferences({ minGapMinutes: gapMinutes });
      setGapMinutes(saved?.minGapMinutes ?? gapMinutes);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save gap preference");
    } finally {
      setSavingGap(false);
    }
  };

  // ── Open add / edit form ──────────────────────────────────────────────────
  const openAdd = () => {
    setEditingBlock(null);
    setForm(emptyBlockForm());
    setFormError(null);
    setFormVisible(true);
  };

  const openEdit = (block: BusyBlock) => {
    setEditingBlock(block);
    setForm(blockToFormState(block));
    setFormError(null);
    setFormVisible(true);
  };

  // ── Submit form ───────────────────────────────────────────────────────────
  const handleFormSubmit = async () => {
    const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
    const payloads: CreateBusyBlockPayload[] = [];

    if (form.blockType === "WEEKLY") {
      const err = validateSchedule(form.schedule);
      if (err) { setFormError(err); return; }

      // Build a single BusyBlock with weeklySchedule — one entry per enabled day
      const weeklySchedule: Array<{ dayOfWeek: number; times: Array<{ startTime: string; endTime: string }> }> = [];
      DAY_KEYS.forEach((key) => {
        const day = form.schedule[key];
        if (!day.enabled || !day.blocks.length) return;
        weeklySchedule.push({
          dayOfWeek: DAY_INDEX[key as DayKey],
          times: day.blocks.map((b) => ({ startTime: b.range.start, endTime: b.range.end })),
        });
      });

      if (!weeklySchedule.length) { setFormError("Enable at least one day and add a time range"); return; }

      payloads.push({
        blockType: "WEEKLY",
        title: form.title,
        weeklySchedule,
        source: "manual",
      });
    } else if (form.blockType === "DAILY") {
      if (!form.timeRanges.length) { setFormError("Add at least one time range"); return; }
      for (const r of form.timeRanges) {
        if (!HH_MM.test(r.start)) { setFormError(`Invalid start time: "${r.start}" — use HH:MM`); return; }
        if (!HH_MM.test(r.end))   { setFormError(`Invalid end time: "${r.end}" — use HH:MM`); return; }
        if (r.end <= r.start)      { setFormError("End time must be after start time"); return; }
      }
      payloads.push({
        blockType: "DAILY",
        title: form.title,
        times: form.timeRanges.map((r) => ({ startTime: r.start, endTime: r.end })),
        source: "manual",
      });
    } else if (form.blockType === "ONCE") {
      if (!form.onceDate) { setFormError("Select a date"); return; }
      if (!form.timeRanges.length) { setFormError("Add at least one time range"); return; }
      for (const r of form.timeRanges) {
        if (!HH_MM.test(r.start)) { setFormError(`Invalid start time: "${r.start}" — use HH:MM`); return; }
        if (!HH_MM.test(r.end))   { setFormError(`Invalid end time: "${r.end}" — use HH:MM`); return; }
        if (r.end <= r.start)      { setFormError("End time must be after start time"); return; }
      }
      payloads.push({
        blockType: "ONCE",
        title: form.title,
        date: form.onceDate,
        times: form.timeRanges.map((r) => ({ startTime: r.start, endTime: r.end })),
        source: "manual",
      });
    }

    if (!payloads.length) { setFormError("Nothing to save — please configure at least one block"); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (editingBlock) {
        // Replace the old block with the new set
        await deleteBusyBlock(editingBlock._id);
        setBlocks((prev) => prev.filter((b) => b._id !== editingBlock._id));
      }
      const created = await Promise.all(payloads.map((p) => createBusyBlock(p)));
      setBlocks((prev) => [...prev, ...created]);
      setFormVisible(false);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save busy block");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteBusyBlock(confirmDelete._id);
      setBlocks((prev) => prev.filter((b) => b._id !== confirmDelete._id));
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete busy block");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[{ width: "100%", gap: SPACING.xlg }, style]}>
      <GapBox
        gapMinutes={gapMinutes}
        saving={savingGap}
        onDecrement={() => setGapMinutes((v) => Math.max(0, v - 5))}
        onIncrement={() => setGapMinutes((v) => Math.min(120, v + 5))}
        onSave={handleSaveGap}
      />

      <BlocksBox
        blocks={blocks}
        loading={loading}
        onEdit={openEdit}
        onDelete={setConfirmDelete}
        onAdd={openAdd}
      />

      {/* ── Add / Edit popup ─────────────────────────────────── */}
      <PopupBox
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingBlock ? "Edit Busy Block" : "Add Busy Block"}
        titleColor={COLORS.primary1}
        closeOnBackdropPress={false}
      >
        {/* Scrollable form body */}
        <ScrollView
          style={popupStyles.formScroll}
          contentContainerStyle={popupStyles.formScrollContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Block type selector ─────────────────────────── */}
          <AppText style={formStyles.fieldLabel}>Block Type</AppText>
          <View style={formStyles.chipRow}>
            {(["WEEKLY", "DAILY", "ONCE"] as BusyBlockType[]).map((bt) => (
              <Pressable
                key={bt}
                style={[formStyles.chip, form.blockType === bt && formStyles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, blockType: bt }))}
              >
                <AppText style={[formStyles.chipText, form.blockType === bt && formStyles.chipTextActive]}>
                  {BLOCK_TYPE_LABELS[bt]}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* ── Shared: title ────────────────────────────────── */}
          {form.blockType !== "WEEKLY" && (
            <>
              <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.md }]}>Title (optional)</AppText>
              <Input
                type="text"
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="e.g. Morning workout"
              />
            </>
          )}

          {/* ── WEEKLY ─────────────────────────────────────────── */}
          {form.blockType === "WEEKLY" && (
            <WeeklyScheduleEditor
              schedule={form.schedule}
              onChange={(s) => setForm((f) => ({ ...f, schedule: s }))}
            />
          )}

          {/* ── DAILY ──────────────────────────────────────────── */}
          {form.blockType === "DAILY" && (
            <TimeRangesEditor
              ranges={form.timeRanges}
              onChange={(r) => setForm((f) => ({ ...f, timeRanges: r }))}
            />
          )}

          {/* ── ONCE ───────────────────────────────────────────── */}
          {form.blockType === "ONCE" && (
            <>
              <DatePickerField
                label="Date"
                value={form.onceDate}
                onSelect={(d) => setForm((f) => ({ ...f, onceDate: d }))}
              />
              <TimeRangesEditor
                ranges={form.timeRanges}
                onChange={(r) => setForm((f) => ({ ...f, timeRanges: r }))}
              />
            </>
          )}
        </ScrollView>

        {/* Error + buttons — always visible */}
        {formError && (
          <AppText style={popupStyles.errorText}>{formError}</AppText>
        )}

        <BlockFormButtons
          isEditing={editingBlock !== null}
          saving={saving}
          onCancel={() => setFormVisible(false)}
          onSubmit={handleFormSubmit}
        />
      </PopupBox>

      {/* ── Delete confirmation popup ─────────────────────── */}
      <PopupBox
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete Busy Block"
        titleColor={COLORS.primary1}
      >
        <AppText style={popupStyles.confirmText}>
          Delete this busy block
          {confirmDelete?.title ? ` ("${confirmDelete.title}")` : ""}?
        </AppText>
        <View style={popupStyles.btnRow}>
          <AppButton
            title="Cancel"
            mode="light"
            color="lightGray"
            onPress={() => setConfirmDelete(null)}
            width="48%"
            disabled={deleting}
          />
          <AppButton
            title={deleting ? "Deleting…" : "Delete"}
            mode="filled"
            color="primary7"
            onPress={handleConfirmDelete}
            width="48%"
            disabled={deleting}
          />
        </View>
      </PopupBox>

      {/* ── Generic error popup ───────────────────────────── */}
      <PopupBox
        visible={errorMsg !== null}
        onClose={() => setErrorMsg(null)}
        title="Error"
        titleColor={COLORS.primary1}
      >
        <AppText style={{ color: COLORS.darkGray, marginBottom: SPACING.lg }}>
          {errorMsg}
        </AppText>
        <AppButton
          title="OK"
          mode="filled"
          color="primary1"
          onPress={() => setErrorMsg(null)}
          width="100%"
        />
      </PopupBox>
    </View>
  );
}

const popupStyles = StyleSheet.create({
  /* ── form modal ─────────────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modalSheet: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: COLORS.colorWhite,
    borderRadius: 18,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg ?? FONT_SIZES.base + 4,
    fontWeight: "700",
    color: COLORS.primary1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white3,
  },
  formScroll: {
    flexGrow: 1,
  },
  formScrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.white3,
    padding: SPACING.md,
    backgroundColor: COLORS.colorWhite,
  },
  /* ── shared ─────────────────────────────────────────────────────── */
  errorText: { color: "#C62828", fontSize: FONT_SIZES.sm, marginBottom: SPACING.sm },
  confirmText: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * 1.6,
  },
  btnRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
  },
});

