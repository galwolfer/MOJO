/**
 * BusyBlocksSection
 *
 * Two boxes rendered at the bottom of EditPreferences:
 *
 * 1. "Gap Between Tasks" — compact stepper (−/+) that persists minGapMinutes.
 * 2. "Busy Blocks" — daily unavailability windows (title + start/end time),
 *    with Add / Edit (popup form) and Delete (confirmation popup) actions.
 *
 * The form only asks for a title (optional) and a start/end time (HH:MM).
 * Every block applies every day with no end date.
 *
 * Form sub-components:
 *   TitleField, TimeRangeFields, BlockFormFields,
 *   BlockFormButtons, BlockItem, GapBox, BlocksBox
 *
 * All error and confirmation dialogs use PopupBox — no native Alert calls.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
} from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import Input from "../inputs/Input";
import Box from "../layout/Box";
import PopupBox from "../common/PopupBox";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { ICONS } from "../icons/icons";
import {
  listBusyBlocks,
  createBusyBlock,
  updateBusyBlock,
  deleteBusyBlock,
  validateBusyBlockPayload,
  type BusyBlock,
  type BusyBlockType,
} from "../../services/busyBlockService";
import {
  getSchedulingPreferences,
  updateSchedulingPreferences,
} from "../../services/apiClient";

// ──────────────────────────────────────────────────────────────────────────────
// Domain helpers (pure — no React)
// ──────────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUFFER_OPTIONS: number[] = [0, 5, 10, 15, 30];

const BLOCK_TYPE_LABELS: Record<BusyBlockType, string> = {
  DAILY:    "Every day",
  WEEKLY:   "Weekly",
  ONCE:     "Specific date",
  FULL_DAY: "Day off",
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
  if (block.blockType === "FULL_DAY") {
    if (block.daysOfWeek?.length) {
      const days = block.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
      return `Full day off — ${days}`;
    }
    return block.date ? `Full day off — ${block.date.slice(0, 10)}` : "Full day off";
  }
  if (block.blockType === "ONCE") {
    const dateStr = block.date ? new Date(block.date).toISOString().slice(0, 10) : "";
    return `${dateStr} ∣ ${block.startTime ?? "?"} – ${block.endTime ?? "?"}`;
  }
  if (block.blockType === "WEEKLY") {
    const days = (block.daysOfWeek ?? []).map((d) => DAY_LABELS[d]).join(", ");
    return `${days} ∣ ${block.startTime ?? "?"} – ${block.endTime ?? "?"}`;
  }
  if (block.blockType === "DAILY") {
    return `Every day ∣ ${block.startTime ?? "?"} – ${block.endTime ?? "?"}`;
  }
  // Legacy
  if (block.start && block.end) {
    return `${isoToTimePart(block.start)} – ${isoToTimePart(block.end)}`;
  }
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface BlockFormState {
  title: string;
  blockType: BusyBlockType;
  // Date (ONCE / FULL_DAY one-time)
  date: string;               // YYYY-MM-DD
  // Days of week (WEEKLY / FULL_DAY recurring)
  daysOfWeek: number[];
  // Recurrence end (DAILY / WEEKLY / FULL_DAY recurring)
  recurrenceEndDate: string;  // YYYY-MM-DD or ""
  // Times (all except FULL_DAY)
  startTime: string;          // HH:MM
  endTime: string;            // HH:MM
  // Buffer
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}

const EMPTY_FORM: BlockFormState = {
  title: "",
  blockType: "DAILY",
  date: "",
  daysOfWeek: [],
  recurrenceEndDate: "",
  startTime: "09:00",
  endTime: "10:00",
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
};

function blockToForm(block: BusyBlock): BlockFormState {
  const type = block.blockType ?? "DAILY";
  return {
    title: block.title || "",
    blockType: type,
    date: block.date ? new Date(block.date).toISOString().slice(0, 10) : "",
    daysOfWeek: block.daysOfWeek ?? [],
    recurrenceEndDate: block.recurrenceEndDate
      ? new Date(block.recurrenceEndDate).toISOString().slice(0, 10)
      : "",
    startTime: block.startTime ?? (block.start ? isoToTimePart(block.start) : "09:00"),
    endTime:   block.endTime   ?? (block.end   ? isoToTimePart(block.end)   : "10:00"),
    bufferBeforeMinutes: block.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes:  block.bufferAfterMinutes  ?? 0,
  };
}

/** Build the API payload from the form state */
function buildPayload(form: BlockFormState) {
  const base = {
    title: form.title,
    blockType: form.blockType,
    bufferBeforeMinutes: form.bufferBeforeMinutes,
    bufferAfterMinutes:  form.bufferAfterMinutes,
    ...(form.blockType !== "FULL_DAY" ? { startTime: form.startTime, endTime: form.endTime } : {}),
    ...((form.blockType === "ONCE" || form.blockType === "FULL_DAY") && form.date
      ? { date: form.date } : {}),
    ...((form.blockType === "WEEKLY" || form.blockType === "FULL_DAY")
      ? { daysOfWeek: form.daysOfWeek } : {}),
    ...(form.blockType !== "ONCE"
      ? { recurrenceEndDate: form.recurrenceEndDate || null } : {}),
  };
  return base;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

// ── TypePicker ────────────────────────────────────────────────────────────────
interface TypePickerProps {
  value: BusyBlockType;
  onChange: (v: BusyBlockType) => void;
}

const BLOCK_TYPES: BusyBlockType[] = ["DAILY", "WEEKLY", "ONCE", "FULL_DAY"];

function TypePicker({ value, onChange }: TypePickerProps) {
  return (
    <>
      <AppText style={formStyles.fieldLabel}>Block type</AppText>
      <View style={formStyles.chipRow}>
        {BLOCK_TYPES.map((t) => (
          <Pressable
            key={t}
            style={[formStyles.chip, value === t && formStyles.chipActive]}
            onPress={() => onChange(t)}
          >
            <AppText style={[formStyles.chipText, value === t && formStyles.chipTextActive]}>
              {BLOCK_TYPE_LABELS[t]}
            </AppText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ── DayPicker ─────────────────────────────────────────────────────────────────
interface DayPickerProps {
  selected: number[];
  onChange: (v: number[]) => void;
}

const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DayPicker({ selected, onChange }: DayPickerProps) {
  const toggle = (d: number) =>
    onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);
  return (
    <>
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>
        Days of week
      </AppText>
      <View style={formStyles.dayRow}>
        {DAY_SHORT.map((label, i) => (
          <Pressable
            key={i}
            style={[formStyles.dayCircle, selected.includes(i) && formStyles.dayCircleActive]}
            onPress={() => toggle(i)}
          >
            <AppText style={[formStyles.dayText, selected.includes(i) && formStyles.dayTextActive]}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ── BufferPicker ──────────────────────────────────────────────────────────────
interface BufferPickerProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function BufferPicker({ label, value, onChange }: BufferPickerProps) {
  return (
    <>
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>{label}</AppText>
      <View style={formStyles.chipRow}>
        {BUFFER_OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            style={[formStyles.chip, value === opt && formStyles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <AppText style={[formStyles.chipText, value === opt && formStyles.chipTextActive]}>
              {opt === 0 ? "None" : `${opt} min`}
            </AppText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ── TitleField ────────────────────────────────────────────────────────────────
interface TitleFieldProps {
  value: string;
  onChange: (v: string) => void;
}

function TitleField({ value, onChange }: TitleFieldProps) {
  return (
    <>
      <AppText style={formStyles.fieldLabel}>Title (optional)</AppText>
      <Input
        placeholder="e.g. Morning workout"
        value={value}
        onChangeText={onChange}
        type="text"
      />
    </>
  );
}

// ── TimeRangeFields ───────────────────────────────────────────────────────────
interface TimeRangeFieldsProps {
  startTime: string;
  endTime: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

function TimeRangeFields({ startTime, endTime, onStartChange, onEndChange }: TimeRangeFieldsProps) {
  return (
    <>
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>
        Start time (HH:MM)
      </AppText>
      <Input
        placeholder="09:00"
        value={startTime}
        onChangeText={onStartChange}
        type="text"
      />
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>
        End time (HH:MM)
      </AppText>
      <Input
        placeholder="10:00"
        value={endTime}
        onChangeText={onEndChange}
        type="text"
      />
    </>
  );
}

// ── BlockFormFields ───────────────────────────────────────────────────────────
interface BlockFormFieldsProps {
  form: BlockFormState;
  onField: <K extends keyof BlockFormState>(key: K, value: BlockFormState[K]) => void;
}

function BlockFormFields({ form, onField }: BlockFormFieldsProps) {
  const { blockType } = form;
  const showDayPicker = blockType === "WEEKLY" || blockType === "FULL_DAY";
  const showDate      = blockType === "ONCE" || (blockType === "FULL_DAY" && !form.daysOfWeek.length);
  const showTimes     = blockType !== "FULL_DAY";
  const showRecEnd    = blockType === "DAILY" || blockType === "WEEKLY" ||
                        (blockType === "FULL_DAY" && form.daysOfWeek.length > 0);

  return (
    <>
      <TitleField value={form.title} onChange={(v) => onField("title", v)} />

      {/* Type selector */}
      <View style={{ marginTop: SPACING.sm }}>
        <TypePicker value={blockType} onChange={(v) => onField("blockType", v)} />
      </View>

      {/* Day-of-week picker (WEEKLY / FULL_DAY recurring) */}
      {showDayPicker && (
        <DayPicker
          selected={form.daysOfWeek}
          onChange={(v) => onField("daysOfWeek", v)}
        />
      )}

      {/* Specific date (ONCE / FULL_DAY one-time) */}
      {showDate && (
        <>
          <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>
            Date (YYYY-MM-DD)
          </AppText>
          <Input
            placeholder="2026-03-15"
            value={form.date}
            onChangeText={(v) => onField("date", v)}
            type="text"
          />
        </>
      )}

      {/* Start / End time (not needed for FULL_DAY) */}
      {showTimes && (
        <TimeRangeFields
          startTime={form.startTime}
          endTime={form.endTime}
          onStartChange={(v) => onField("startTime", v)}
          onEndChange={(v) => onField("endTime", v)}
        />
      )}

      {/* Recurrence end date */}
      {showRecEnd && (
        <>
          <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>
            Ends on (YYYY-MM-DD, optional)
          </AppText>
          <Input
            placeholder="Leave blank for no end"
            value={form.recurrenceEndDate}
            onChangeText={(v) => onField("recurrenceEndDate", v)}
            type="text"
          />
        </>
      )}

      {/* Buffers */}
      <BufferPicker
        label="Buffer before"
        value={form.bufferBeforeMinutes}
        onChange={(v) => onField("bufferBeforeMinutes", v)}
      />
      <BufferPicker
        label="Buffer after"
        value={form.bufferAfterMinutes}
        onChange={(v) => onField("bufferAfterMinutes", v)}
      />
    </>
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
        title="Cancel"
        mode="light"
        color="lightGray"
        onPress={onCancel}
        width="48%"
        disabled={saving}
      />
      <AppButton
        title={saving ? "Saving…" : isEditing ? "Update" : "Add"}
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
  const bufText = [
    block.bufferBeforeMinutes ? `−${block.bufferBeforeMinutes}m` : "",
    block.bufferAfterMinutes  ? `+${block.bufferAfterMinutes}m`  : "",
  ].filter(Boolean).join(" / ");

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
        {bufText ? (
          <AppText style={blockItemStyles.bufferLabel}>Buffer: {bufText}</AppText>
        ) : null}
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
  bufferLabel: { fontSize: FONT_SIZES.sm, color: COLORS.lightGray },
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
  const [form, setForm] = useState<BlockFormState>(EMPTY_FORM);
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
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormVisible(true);
  };

  const openEdit = (block: BusyBlock) => {
    setEditingBlock(block);
    setForm(blockToForm(block));
    setFormError(null);
    setFormVisible(true);
  };

  const setFormField = <K extends keyof BlockFormState>(
    key: K,
    value: BlockFormState[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  // ── Submit form ───────────────────────────────────────────────────────────
  const handleFormSubmit = async () => {
    const payload = buildPayload(form);
    const validationErr = validateBusyBlockPayload(payload as any);
    if (validationErr) { setFormError(validationErr); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (editingBlock) {
        const updated = await updateBusyBlock(editingBlock._id, payload as any);
        setBlocks((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
      } else {
        const created = await createBusyBlock(payload as any);
        setBlocks((prev) => [...prev, created]);
      }
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
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ width: "100%" }}
        >
          <BlockFormFields form={form} onField={setFormField} />

          {formError && (
            <AppText style={popupStyles.errorText}>{formError}</AppText>
          )}

          <BlockFormButtons
            isEditing={editingBlock !== null}
            saving={saving}
            onCancel={() => setFormVisible(false)}
            onSubmit={handleFormSubmit}
          />
        </ScrollView>
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
  errorText: { color: "#C62828", fontSize: FONT_SIZES.sm, marginTop: SPACING.sm },
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

