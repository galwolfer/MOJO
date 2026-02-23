/**
 * TaskScheduleEditor
 *
 * Self-contained "SCHEDULE" box used inside EditTask.
 *
 * Owns all schedule-editing state (sessions, errors, loading flags, calendar
 * index) so the parent screen stays thin. Receives only:
 *  - taskId        – to call the API
 *  - initialSessions / initialIsManualSchedule – seeded once on mount / when
 *    the parent has finished loading the task
 *  - isLoadingInitial – shows a spinner while the parent is fetching sessions
 *  - onPopup       – delegate popup messages to the parent's <PopupBox>
 *  - onTaskUpdated – notify TaskContext after a successful save
 *
 * Helpers (toLocalDateStr, toLocalTimeStr, combineLocalDateTime,
 * validateEditableSessions) are module-level so they are tree-shakeable and
 * testable independently.
 */

import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../../theme";
import AppText from "../../common/AppText";
import AppButton from "../../common/AppButton";
import Input from "../../inputs/Input";
import CalendarPicker from "../../inputs/CalendarPicker";
import Box from "../../layout/Box";
import { ICONS } from "../../icons/icons";
import {
  getTaskSessions,
  updateTaskSchedule,
  createTaskSchedule,
} from "../../../services/taskService";
import { EditableSession } from "./taskFormTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no React)
// ─────────────────────────────────────────────────────────────────────────────

/** ISO/Date → YYYY-MM-DD in local time */
export function toLocalDateStr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO/Date → HH:MM in local time (24-hour) */
export function toLocalTimeStr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine YYYY-MM-DD + HH:MM into a Date using LOCAL timezone */
export function combineLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/** Validate sessions; returns null if OK or an error string */
export function validateEditableSessions(sessions: EditableSession[]): string | null {
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s.date) return `Session ${i + 1}: date is required`;
    if (!/^\d{2}:\d{2}$/.test(s.startTime)) return `Session ${i + 1}: start time must be HH:MM`;
    if (!/^\d{2}:\d{2}$/.test(s.endTime)) return `Session ${i + 1}: end time must be HH:MM`;
    const start = combineLocalDateTime(s.date, s.startTime);
    const end = combineLocalDateTime(s.date, s.endTime);
    if (isNaN(start.getTime())) return `Session ${i + 1}: invalid date`;
    if (end <= start) return `Session ${i + 1}: end must be after start`;
  }
  // Overlap check
  const sorted = [...sessions.map((s, i) => ({ s, i }))].sort(
    (a, b) =>
      combineLocalDateTime(a.s.date, a.s.startTime).getTime() -
      combineLocalDateTime(b.s.date, b.s.startTime).getTime(),
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    const currEnd = combineLocalDateTime(sorted[i].s.date, sorted[i].s.endTime);
    const nextStart = combineLocalDateTime(sorted[i + 1].s.date, sorted[i + 1].s.startTime);
    if (currEnd > nextStart) {
      return `Sessions ${sorted[i].i + 1} and ${sorted[i + 1].i + 1} overlap`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  taskId: string;
  /** Sessions fetched by the parent screen; used as initial state seed */
  initialSessions: EditableSession[];
  /** Whether the task is currently in manual-schedule mode */
  initialIsManualSchedule: boolean;
  /** True while the parent is still loading the task / sessions from the API */
  isLoadingInitial: boolean;
  /** Delegate popup messages (success / error toasts) to the parent's PopupBox */
  onPopup: (title: string, message: string) => void;
  /** Called whenever a save or auto-schedule succeeds so TaskContext can refresh */
  onTaskUpdated: () => void;
}

const TaskScheduleEditor: React.FC<Props> = ({
  taskId,
  initialSessions,
  initialIsManualSchedule,
  isLoadingInitial,
  onPopup,
  onTaskUpdated,
}) => {
  // ── Local state ────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<EditableSession[]>(initialSessions);
  const [isManual, setIsManual] = useState(initialIsManualSchedule);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [activeCalendarIdx, setActiveCalendarIdx] = useState<number>(-1);

  // Sync when parent finishes loading (initial values arrive after async fetch)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setIsManual(initialIsManualSchedule);
  }, [initialIsManualSchedule]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddSession = useCallback(() => {
    const today = toLocalDateStr(new Date());
    setSessions((prev) => [
      ...prev,
      { date: today, startTime: "09:00", endTime: "10:00", subtaskIndex: null },
    ]);
    setScheduleError(null);
  }, []);

  const handleRemoveSession = useCallback((idx: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx));
    setActiveCalendarIdx(-1);
    setScheduleError(null);
  }, []);

  const updateSessionField = useCallback(
    (idx: number, field: keyof EditableSession, value: string | number | null) => {
      setSessions((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value };
        return next;
      });
      setScheduleError(null);
    },
    [],
  );

  const handleSaveSchedule = useCallback(async () => {
    const validErr = validateEditableSessions(sessions);
    if (validErr) {
      setScheduleError(validErr);
      return;
    }
    setScheduleError(null);
    setIsSaving(true);
    try {
      const payload = sessions.map((s) => ({
        id: s.id,
        start: combineLocalDateTime(s.date, s.startTime).toISOString(),
        end: combineLocalDateTime(s.date, s.endTime).toISOString(),
        subtaskIndex: s.subtaskIndex ?? null,
      }));
      const result = await updateTaskSchedule(taskId, payload);
      if (result.success) {
        setIsManual(true);
        setSessions(
          result.sessions.map((s: any) => ({
            id: s._id,
            date: toLocalDateStr(s.start),
            startTime: toLocalTimeStr(s.start),
            endTime: toLocalTimeStr(s.end),
            subtaskIndex: s.subtaskIndex ?? null,
          })),
        );
        onTaskUpdated();
        onPopup("Schedule Saved! ✅", "Your custom schedule has been saved. The auto-scheduler will no longer modify it.");
      } else {
        setScheduleError(result.error ?? "Failed to save schedule");
      }
    } catch (err: any) {
      setScheduleError(err?.message ?? "Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  }, [sessions, taskId, onTaskUpdated, onPopup]);

  const handleAutoSchedule = useCallback(async () => {
    if (!taskId) return;
    setIsAutoScheduling(true);
    setScheduleError(null);
    try {
      const result = await createTaskSchedule(taskId, { planningHorizonDays: 14 });
      if (result?.success) {
        setIsManual(false);
        const sessionsData = await getTaskSessions(taskId);
        if (sessionsData) {
          setSessions(
            (sessionsData.sessions ?? [])
              .filter((s: any) => s.status !== "completed")
              .map((s: any) => ({
                id: s._id,
                date: toLocalDateStr(s.start),
                startTime: toLocalTimeStr(s.start),
                endTime: toLocalTimeStr(s.end),
                subtaskIndex: s.subtaskIndex ?? null,
              })),
          );
        }
        onTaskUpdated();
        onPopup("Auto-Schedule Applied ✅", `${result.scheduledCount} session(s) generated by the scheduler.`);
      } else if (result === null) {
        // null means a network/server error (createTaskSchedule swallows throw)
        setScheduleError("Auto-scheduling request failed. Please check your connection and try again.");
      } else {
        setScheduleError("Auto-scheduling found no available time slots within the planning horizon.");
      }
    } catch (err: any) {
      setScheduleError(err?.message ?? "Auto-scheduling failed");
    } finally {
      setIsAutoScheduling(false);
    }
  }, [taskId, onTaskUpdated, onPopup]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box title="SCHEDULE" style={styles.boxContent}>
      {isLoadingInitial ? (
        <ActivityIndicator size="small" color={COLORS.primary1} style={{ marginVertical: SPACING.md }} />
      ) : (
        <>
          {/* Mode badge row */}
          <View style={styles.modeRow}>
            <View style={styles.modeBadge}>
              <AppText
                variant="notes"
                style={[styles.modeText, isManual ? styles.modeManual : styles.modeAuto]}
              >
                {isManual ? "🔒 Manual — auto-scheduler Disabled" : "⚡ Auto-managed"}
              </AppText>
            </View>
            {isManual && (
              <AppButton
                title={isAutoScheduling ? "…" : "Auto-Schedule"}
                onPress={handleAutoSchedule}
                mode="light"
                color="primary1"
                width="45%"
                disabled={isAutoScheduling}
              />
            )}
          </View>

          {/* Empty state */}
          {sessions.length === 0 && (
            <AppText variant="notes" style={styles.emptyNote}>
              No sessions scheduled. Add one below or use Auto-Schedule.
            </AppText>
          )}

          {/* Session cards */}
          {sessions.map((session, idx) => (
            <View key={session.id ?? `new-${idx}`} style={styles.sessionCard}>
              {/* Header */}
              <View style={styles.sessionCardHeader}>
                <AppText variant="boldText" style={styles.sessionCardTitle}>
                  Session {idx + 1}
                  {session.subtaskIndex != null ? ` — Part ${session.subtaskIndex}` : ""}
                </AppText>
                <Pressable
                  onPress={() => handleRemoveSession(idx)}
                  style={styles.deleteBtn}
                  hitSlop={8}
                >
                  <AppText style={styles.deleteBtnText}>✕</AppText>
                </Pressable>
              </View>

              {/* Date selector */}
              <View style={styles.fieldRow}>
                <AppText style={styles.fieldLabel}>Date</AppText>
                <Pressable
                  onPress={() => setActiveCalendarIdx(activeCalendarIdx === idx ? -1 : idx)}
                  style={styles.datePill}
                >
                  <AppText style={styles.datePillText}>{session.date || "Select date"}</AppText>
                  {ICONS.calendar &&
                    React.createElement(ICONS.calendar, { size: 16, color: COLORS.primary1 })}
                </Pressable>
              </View>

              {activeCalendarIdx === idx && (
                <View style={styles.inlineCalendar}>
                  <CalendarPicker
                    selectedDate={session.date}
                    onDateSelect={(d: string) => {
                      updateSessionField(idx, "date", d);
                      setActiveCalendarIdx(-1);
                    }}
                  />
                </View>
              )}

              {/* Start + End time */}
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <AppText style={styles.fieldLabel}>Start (HH:MM)</AppText>
                  <Input
                    placeholder="09:00"
                    value={session.startTime}
                    onChangeText={(v) => updateSessionField(idx, "startTime", v)}
                    type="text"
                  />
                </View>
                <View style={styles.timeField}>
                  <AppText style={styles.fieldLabel}>End (HH:MM)</AppText>
                  <Input
                    placeholder="10:00"
                    value={session.endTime}
                    onChangeText={(v) => updateSessionField(idx, "endTime", v)}
                    type="text"
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Add session */}
          <View style={{ marginTop: SPACING.sm }}>
            <AppButton
              title="+ Add Session"
              onPress={handleAddSession}
              mode="light"
              color="primary1"
              width="100%"
            />
          </View>

          {/* Inline error */}
          {scheduleError && (
            <View style={styles.errorBox}>
              <AppText style={styles.errorText}>{scheduleError}</AppText>
            </View>
          )}

          {/* Save */}
          <View style={{ marginTop: SPACING.md }}>
            <AppButton
              title={isSaving ? "Saving…" : "Save Schedule"}
              onPress={handleSaveSchedule}
              mode="filled"
              color="primary1"
              width="100%"
              disabled={isSaving}
            />
          </View>
        </>
      )}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  boxContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    overflow: "visible",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  modeBadge: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  modeText: {
    fontSize: FONT_SIZES.sm,
  },
  modeManual: {
    color: COLORS.primary1,
    fontWeight: "600",
  },
  modeAuto: {
    color: COLORS.darkGray,
  },
  emptyNote: {
    color: COLORS.darkGray,
    marginVertical: SPACING.md,
    textAlign: "center",
  },
  sessionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary1,
    ...SHADOWS.card,
  },
  sessionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sessionCardTitle: {
    color: COLORS.primary1,
    fontSize: FONT_SIZES.sm,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: COLORS.primary7,
    fontSize: FONT_SIZES.md,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  fieldLabel: {
    color: COLORS.darkGray,
    fontSize: FONT_SIZES.sm,
    minWidth: 50,
  },
  datePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white3,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  datePillText: {
    color: COLORS.primary1,
    fontSize: FONT_SIZES.sm,
  },
  inlineCalendar: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  timeRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  timeField: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary7,
  },
  errorText: {
    color: COLORS.primary7,
    fontSize: FONT_SIZES.sm,
  },
});

export default TaskScheduleEditor;
