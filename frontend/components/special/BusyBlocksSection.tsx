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
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, ViewStyle } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import Input from "../inputs/Input";
import Box from "../layout/Box";
import SliderComponent from "../inputs/Slider";
import PopupBox from "../common/PopupBox";
import ScheduledSessionsSection from "./task/ScheduledSessionsSection";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { ICONS } from "../icons/icons";
import {
  listBusyBlocks,
  createBusyBlock,
  updateBusyBlock,
  deleteBusyBlock,
  type BusyBlock,
} from "../../services/busyBlockService";
import { getSchedulingPreferences, updateSchedulingPreferences } from "../../services/apiClient";

// ──────────────────────────────────────────────────────────────────────────────
// Domain helpers (pure — no React)
// ──────────────────────────────────────────────────────────────────────────────

function isoToDatePart(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function isoToTimePart(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "00:00";
  }
}

/** Combine a YYYY-MM-DD date and HH:MM time into a local-time ISO string. */
function combineDatetime(date: string, time: string): string {
  if (!date) return "";
  const [h, m] = (time || "00:00").split(":").map(Number);
  const d = new Date(date);
  d.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
  return d.toISOString();
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${isoToTimePart(startIso)} – ${isoToTimePart(endIso)}`;
}

/** Validate HH:MM start/end times. Returns error string or null. */
function validateTimes(startTime: string, endTime: string): string | null {
  if (!startTime) return "Start time is required";
  if (!endTime) return "End time is required";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return "Invalid time format — use HH:MM";
  if (eh * 60 + em <= sh * 60 + sm) return "End time must be after start time";
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface BlockFormState {
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

const EMPTY_FORM: BlockFormState = {
  title: "",
  startTime: "09:00",
  endTime: "10:00",
};

function blockToForm(block: BusyBlock): BlockFormState {
  return {
    title: block.title || "",
    startTime: isoToTimePart(block.start),
    endTime: isoToTimePart(block.end),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

// ── TitleField ────────────────────────────────────────────────────────────────
interface TitleFieldProps {
  value: string;
  onChange: (v: string) => void;
}

function TitleField({ value, onChange }: TitleFieldProps) {
  return (
    <>
      <AppText style={formStyles.fieldLabel}>Title (optional)</AppText>
      <Input placeholder="e.g. Morning workout" value={value} onChangeText={onChange} type="text" />
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
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>Start time (HH:MM)</AppText>
      <Input placeholder="09:00" value={startTime} onChangeText={onStartChange} type="text" />
      <AppText style={[formStyles.fieldLabel, { marginTop: SPACING.sm }]}>End time (HH:MM)</AppText>
      <Input placeholder="10:00" value={endTime} onChangeText={onEndChange} type="text" />
    </>
  );
}

// ── BlockFormFields ───────────────────────────────────────────────────────────
interface BlockFormFieldsProps {
  form: BlockFormState;
  onField: <K extends keyof BlockFormState>(key: K, value: BlockFormState[K]) => void;
}

function BlockFormFields({ form, onField }: BlockFormFieldsProps) {
  return (
    <>
      <TitleField value={form.title} onChange={(v) => onField("title", v)} />
      <TimeRangeFields
        startTime={form.startTime}
        endTime={form.endTime}
        onStartChange={(v) => onField("startTime", v)}
        onEndChange={(v) => onField("endTime", v)}
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
      <AppButton title="Cancel" mode="light" color="lightGray" onPress={onCancel} width="48%" disabled={saving} />
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
  return (
    <View style={blockItemStyles.container}>
      <View style={blockItemStyles.info}>
        {block.title ? <AppText style={blockItemStyles.title}>{block.title}</AppText> : null}
        <AppText style={blockItemStyles.timeRange}>{formatTimeRange(block.start, block.end)}</AppText>
      </View>
      <View style={blockItemStyles.actions}>
        <Pressable
          style={[blockItemStyles.iconBtn, { backgroundColor: COLORS.white2 ?? "#F0F0F8" }]}
          onPress={() => onEdit(block)}
        >
          {ICONS.edit ? React.createElement(ICONS.edit, { size: 15, color: COLORS.primary1 }) : null}
        </Pressable>
        <Pressable style={[blockItemStyles.iconBtn, { backgroundColor: "#FFEBEE" }]} onPress={() => onDelete(block)}>
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
  onChange: (newValue: number) => void;
  onSave: () => void;
}

function GapBox({ gapMinutes, saving, onChange, onSave }: GapBoxProps) {
  return (
    <Box title="GAP BETWEEN TASKS" titleColor={COLORS.primary1} style={gapBoxStyles.box}>
      <AppText style={gapBoxStyles.helpText}>Minimum minutes of free time between two scheduled sessions.</AppText>

      <SliderComponent
        value={gapMinutes}
        onValueChange={onChange}
        min={0}
        max={120}
        step={5}
        label={`${gapMinutes} min`}
        style={{ marginVertical: SPACING.sm, width: "100%" }}
      />

      <AppButton
        title={saving ? "…" : "Save"}
        mode="filled"
        color="primary6"
        onPress={onSave}
        disabled={saving}
        style={[gapBoxStyles.saveBtn, { width: "100%" }]}
      />
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
  saveBtn: { width: "100%" },
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
  // convert busy blocks to ScheduledSession-like objects for display
  const sessions = blocks.map(
    (b, idx) =>
      ({
        start: b.start,
        end: b.end,
        subtaskTitle: b.title || `Block ${idx + 1}`,
      }) as any,
  );

  return (
    <Box title="BUSY BLOCKS" titleColor={COLORS.primary1} style={blocksBoxStyles.box}>
      <AppText style={blocksBoxStyles.helpText}>
        Mark when you're unavailable. Mojo won't schedule tasks during these windows.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary1} style={{ marginVertical: SPACING.lg }} />
      ) : (
        <>
          {sessions.length === 0 ? (
            <AppText style={blocksBoxStyles.emptyText}>No busy blocks yet.</AppText>
          ) : (
            <ScheduledSessionsSection
              taskId="busy-blocks"
              taskTitle=""
              scheduledSessions={sessions}
              hideTitle={true}
              dividerColor={COLORS.lightGray}
              showCheckbox={false}
              onEditSession={(taskId, session, index) => {
                onEdit(blocks[index]);
              }}
            />
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
      const [fetchedBlocks, prefs] = await Promise.all([listBusyBlocks(), getSchedulingPreferences()]);
      setBlocks(fetchedBlocks);
      setGapMinutes(prefs?.minGapMinutes ?? 10);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const setFormField = <K extends keyof BlockFormState>(key: K, value: BlockFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Submit form ───────────────────────────────────────────────────────────
  const handleFormSubmit = async () => {
    const validationErr = validateTimes(form.startTime, form.endTime);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    // Reference date = today; only the time-of-day matters for daily blocks
    const refDate = isoToDatePart(new Date().toISOString());
    const payload = {
      title: form.title,
      start: combineDatetime(refDate, form.startTime),
      end: combineDatetime(refDate, form.endTime),
      isRecurring: true,
      recurrence: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // every day
        endDate: null,
      },
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editingBlock) {
        const updated = await updateBusyBlock(editingBlock._id, payload);
        setBlocks((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
      } else {
        const created = await createBusyBlock(payload);
        setBlocks((prev) =>
          [...prev, created].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
        );
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
      <GapBox gapMinutes={gapMinutes} saving={savingGap} onChange={(v) => setGapMinutes(v)} onSave={handleSaveGap} />

      <BlocksBox blocks={blocks} loading={loading} onEdit={openEdit} onDelete={setConfirmDelete} onAdd={openAdd} />

      {/* ── Add / Edit popup ─────────────────────────────────── */}
      <PopupBox
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingBlock ? "Edit Busy Block" : "Add Busy Block"}
        titleColor={COLORS.primary1}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ width: "100%" }}>
          <BlockFormFields form={form} onField={setFormField} />

          {formError && <AppText style={popupStyles.errorText}>{formError}</AppText>}

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
        <AppText style={{ color: COLORS.darkGray, marginBottom: SPACING.lg }}>{errorMsg}</AppText>
        <AppButton title="OK" mode="filled" color="primary1" onPress={() => setErrorMsg(null)} width="100%" />
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
