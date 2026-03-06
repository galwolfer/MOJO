/**
 * BusyBlockForm — exports the BlockFormState type consumed by BusyBlocksSection.
 *
 * The actual form rendering is inlined inside BusyBlocksSection.tsx so it can
 * share WeeklyScheduleEditor, DatePickerField, and TimeRangesEditor.
 * This file only exports the shared type so both files stay in sync.
 */
import type { WeeklySchedule, TimeRange } from "../../../components/special/WeeklyScheduleEditor";

export type BusyBlockFormType = "DAILY" | "WEEKLY" | "ONCE";

/** Full state of the Add/Edit busy-block form. */
export interface BlockFormState {
  /** Which mode the user has selected */
  blockType: BusyBlockFormType;
  /** Optional user label */
  title: string;
  /** WEEKLY: per-day schedule managed by WeeklyScheduleEditor */
  schedule: WeeklySchedule;
  /** DAILY and ONCE: flat list of time ranges */
  timeRanges: TimeRange[];
  /** ONCE: ISO date string (YYYY-MM-DD) */
  onceDate: string;
}
