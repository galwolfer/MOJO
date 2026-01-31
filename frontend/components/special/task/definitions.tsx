import { formatDate, formatDuration } from "../../widgets/taskHelpers";
import FieldRow from "./FieldRow";

/**
 * FIELD_DEFINITIONS
 * Defines how task fields should be displayed in the UI.
 * Maps field keys to display configuration including labels, icons, and formatters.
 * Used by renderTaskField to create consistent field rendering across components.
 */
export const FIELD_DEFINITIONS: Record<
  string,
  { label: string; icon?: string; formatter?: (v: any, task?: any) => any }
> = {
  taskname: { label: "Title", icon: "list" },
  title: { label: "Title", icon: "list" },
  description: { label: "Description", icon: "note" },
  dueDate: { label: "Due Date", icon: "calendar", formatter: (v) => formatDate(v) },
  earliestStart: { label: "Earliest Start", icon: "calendar", formatter: (v) => formatDate(v) },
  estimatedDuration: { label: "Estimated Duration", icon: "clock", formatter: (v) => formatDuration(v) },
  duration: { label: "Duration", icon: "clock", formatter: (v) => formatDuration(v) },
  importance: { label: "Importance", icon: "highPriority", formatter: (v) => (v ? String(v) : "Not set") },
  effort: { label: "Effort", icon: "flame", formatter: (v) => (v ? String(v) : "Not set") },
  category: { label: "Category", icon: "tag" },
  subCategory: { label: "Subcategory", icon: "tag" },
  progressPercentage: {
    label: "Progress",
    icon: "progress",
    formatter: (v) => (typeof v === "number" ? `${Math.round(v)}%` : "-"),
  },
  taskType: { label: "Task Type", icon: "check" },
  chunkCount: { label: "Chunks", icon: "puzzle" },
  chunkMinutes: { label: "Chunk", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  minChunk: { label: "Min Chunk", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  canSplit: { label: "Splitable", icon: "split", formatter: (v) => (v ? "Can be split" : "No") },
  sessionRange: {
    label: "Session Range",
    icon: "clock",
    formatter: (_v, task) => {
      if (task?.minMinutes && task?.maxMinutes)
        return `${formatDuration(task.minMinutes)} - ${formatDuration(task.maxMinutes)}`;
      return "-";
    },
  },
  minMinutes: { label: "Min Session", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  maxMinutes: { label: "Max Session", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  tags: { label: "Tags", icon: "tag", formatter: (v) => (Array.isArray(v) ? v.join(", ") : "-") },
  status: { label: "Status", icon: "check" },
  startDate: { label: "Start Date", icon: "calendar", formatter: (v) => formatDate(v) },
  recurrence: {
    label: "Recurrence",
    icon: "repeat",
    formatter: (v) => {
      if (!v) return "-";
      const interval = v.interval ? ` • every ${v.interval}` : "";
      const until = v.endDate ? ` • until ${formatDate(v.endDate)}` : v.count ? ` • ${v.count} times` : "";
      return `${v.type}${interval}${until}`;
    },
  },
};

/**
 * renderTaskField
 * Renders a single task field using the FIELD_DEFINITIONS configuration.
 * Handles special cases like conditional rendering and value formatting.
 * Returns null if the field should not be displayed (empty, invalid, or conditionally hidden).
 * @param task - The task object containing field values
 * @param key - The field key to render
 * @returns A FieldRow component or null if field should be hidden
 */
export const renderTaskField = (task: any, key: string) => {
  const def = FIELD_DEFINITIONS[key];
  if (!def) return null;

  // Special case: hide minChunk if chunkMinutes is set
  if (key === "minChunk" && (task?.chunkMinutes || task?.chunkMinutes === 0)) return null;
  // Special case: hide canSplit for leaky tasks
  if (key === "canSplit" && task?.taskType === "leaky") return null;

  // Get raw value, with special handling for subcategory
  const rawValue =
    task[key] ?? (key === "subcategory" ? task.subcategoryDisplay || task.subCategory?.label : undefined);
  // Apply formatter if defined
  const rendered = def.formatter ? def.formatter(rawValue, task) : rawValue;

  // Don't render null/undefined values
  if (rendered === null || rendered === undefined) return null;
  // Don't render empty or placeholder strings
  if (typeof rendered === "string") {
    const trimmed = rendered.trim();
    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "." ||
      trimmed === "Not set" ||
      trimmed === "Not scheduled" ||
      trimmed === "Time TBD"
    )
      return null;
  }

  return (
    <FieldRow key={key} icon={def.icon} label={def.label}>
      {typeof rendered === "string" || typeof rendered === "number" ? String(rendered) : rendered}
    </FieldRow>
  );
};

export default { FIELD_DEFINITIONS, renderTaskField };
