import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import Tag from "../inputs/tag";
import Icon from "../icons/Icon";
import { COLORS, ICON_SIZES, SPACING } from "../../theme";
import { getCategoryMeta } from "../../config/categoryMeta";
import {
  formatDate,
  getImportanceLabel,
  getEffortLabel,
  formatDuration,
  ScheduledSession,
  Subtask,
  sessionRowData,
  getTaskTypeLabel,
} from "./widgetHelpers";
import { ICONS } from "../icons/icons";
import { Checkbox } from "../icons/Checkbox";
import List, { ListCellProps } from "../layout/List";
import { useWindowDimensions } from "react-native";
import { ProgressIcon } from "../icons/ProgressIcon";

/**
 * Generic FieldRow - shows an icon, label and a formatted value for a given task field
 */
export const FieldRow: React.FC<{
  icon?: string;
  label: string;
  value?: any;
  formatter?: (v: any, task?: any) => React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, label, value, formatter, children }) => (
  <View style={styles.field}>
    <View style={styles.labelRow}>
      {icon ? <Icon name={icon} size={ICON_SIZES.sm} color={COLORS.lightGray} style={styles.labelIcon} /> : null}
      <AppText variant="notes" style={styles.labelText}>
        {label}
      </AppText>
    </View>
    <AppText variant="bodyText">
      {formatter ? formatter(value) : (children ?? (value !== undefined && value !== null ? String(value) : "-"))}
    </AppText>
  </View>
);

/**
 * TwoColumnGrid — reusable 2-up grid for short detail items
 * Accepts an array of React nodes (each should render a FieldRow or similar)
 */
export const TwoColumnGrid: React.FC<{ items: React.ReactNode[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <View style={styles.gridContainer}>
      {visible.map((it, i) => (
        <View key={i} style={styles.gridItem}>
          {typeof it === "string" || typeof it === "number"
            ? (() => {
                // Debug: if we received a primitive here, log it with a stack trace to locate the source
                console.debug("TwoColumnGrid: primitive item", String(it), new Error().stack);
                return <AppText>{String(it)}</AppText>;
              })()
            : it}
        </View>
      ))}
    </View>
  );
};

/**
 * Definitions mapping Task schema fields to a label, icon and optional formatter
 * Extend this object when you add/need more fields in the add-task form
 */
export const FIELD_DEFINITIONS: Record<
  string,
  { label: string; icon?: string; formatter?: (v: any, task?: any) => React.ReactNode }
> = {
  taskname: { label: "Title", icon: "list" },
  title: { label: "Title", icon: "list" },
  description: { label: "Description", icon: "note" },
  dueDate: { label: "Due Date", icon: "calendar", formatter: (v) => formatDate(v) },
  earliestStart: { label: "Earliest Start", icon: "calendar", formatter: (v) => formatDate(v) },
  estimatedDuration: { label: "Estimated Duration", icon: "clock", formatter: (v) => formatDuration(v) },
  duration: { label: "Duration", icon: "clock", formatter: (v) => formatDuration(v) },
  importance: { label: "Importance", icon: "highPriority", formatter: (v) => getImportanceLabel(v ?? undefined) },
  effort: { label: "Effort", icon: "flame", formatter: (v) => getEffortLabel(v ?? undefined) },
  category: { label: "Category", icon: "tag" },
  subCategory: { label: "Subcategory", icon: "tag" },
  progressPercentage: {
    label: "Progress",
    icon: "progress",
    formatter: (v) => (typeof v === "number" ? `${Math.round(v)}%` : "-"),
  },
  taskType: { label: "Task Type", icon: "check", formatter: (v, task) => getTaskTypeLabel(v, task?.canSplit) },
  chunkCount: { label: "Chunks", icon: "puzzle" },
  chunkMinutes: { label: "Chunk", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  minChunk: { label: "Min Chunk", icon: "clock", formatter: (v) => formatDuration(v ?? undefined) },
  // Splitting flag
  canSplit: { label: "Splitable", icon: "split", formatter: (v) => (v ? "Can be split" : "No") },
  // Session range (composed from minMinutes & maxMinutes)
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
 * Helper: render a task field by its key using the FIELD_DEFINITIONS mapping
 */
export const renderTaskField = (task: any, key: string) => {
  const def = FIELD_DEFINITIONS[key];
  if (!def) return null;

  // Special-cases:
  // When both chunkMinutes and minChunk are present, prefer chunkMinutes and hide minChunk
  if (key === "minChunk" && (task?.chunkMinutes || task?.chunkMinutes === 0)) return null;
  // If task type is 'leaky' (Flexible timing), do not show the splittable flag
  if (key === "canSplit" && task?.taskType === "leaky") return null;

  const rawValue =
    task[key] ?? (key === "subcategory" ? task.subcategoryDisplay || task.subCategory?.label : undefined);
  const rendered = def.formatter ? def.formatter(rawValue, task) : rawValue;

  // Treat common placeholder strings as empty (do not render)
  if (rendered === null || rendered === undefined) return null;
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

  // If rendered is a React node or valid number/string, display it
  return (
    <FieldRow key={key} icon={def.icon} label={def.label}>
      {typeof rendered === "string" || typeof rendered === "number" ? String(rendered) : rendered}
    </FieldRow>
  );
};

export const TaskTitle: React.FC<{
  title?: string;
  taskname?: string;
  category?: string;
  size?: "sm" | "md" | "lg";
}> = ({ title, taskname, category, size = "lg" }) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";
  return (
    <View style={styles.titleRow}>
      {meta?.icon ? <Icon name={meta.icon} size={iconSize} color={meta.color} style={styles.icon} /> : null}
      <AppText variant={titleVariant} style={styles.titleText} numberOfLines={3}>
        {title || taskname}
      </AppText>
    </View>
  );
};

export const TaskTagsRow: React.FC<{
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  importance?: number | null;
  effort?: number | null;
}> = ({ category, categoryDisplay, subcategory, subcategoryDisplay, importance, effort }) => {
  const categoryMeta = getCategoryMeta(category);
  const subLabel = subcategoryDisplay || subcategory || "";

  const importanceIcon = (imp?: number | null) => {
    if (!imp) return "list";
    if (imp <= 2) return "lowImportant";
    if (imp === 3) return "mediumImportant";
    return "highPriority";
  };

  const importanceColorIndex = (imp?: number | null) => {
    if (!imp) return 8;
    if (imp <= 2) return 6;
    if (imp === 3) return 5;
    return 7;
  };

  const effortIcon = (eff?: number | null) => {
    if (!eff) return "list";
    if (eff <= 2) return "lowEffort";
    if (eff === 3) return "flame";
    return "highEffort";
  };

  const effortColor = (eff?: number | null) => {
    if (!eff) return 8;
    if (eff <= 2) return 6;
    if (eff === 3) return 5;
    return 7;
  };

  return (
    <View style={styles.tagRow}>
      {category && (
        <Tag
          label={categoryDisplay || category}
          leftIcon={categoryMeta.icon}
          colorIndex={categoryMeta.colorIndex}
          style={styles.tagItem}
        />
      )}

      {subLabel ? (
        <Tag label={subLabel} colorIndex={Math.max(0, Math.min(17, subLabel.length % 9))} style={styles.tagItem} />
      ) : null}

      {importance ? (
        <Tag
          label={getImportanceLabel(importance ?? undefined)}
          leftIcon={importanceIcon(importance)}
          colorIndex={importanceColorIndex(importance)}
          style={styles.tagItem}
        />
      ) : null}

      {effort ? (
        <Tag
          label={getEffortLabel(effort ?? undefined)}
          leftIcon={effortIcon(effort)}
          colorIndex={effortColor(effort)}
          style={styles.tagItem}
        />
      ) : null}
    </View>
  );
};

export const TaskDueDate: React.FC<{ dueDate?: string; deadline?: string }> = ({ dueDate, deadline }) => {
  // Render using the generic field renderer so icon/label/formatting are consistent and configurable
  return renderTaskField({ dueDate: dueDate || deadline }, "dueDate") || null;
};

export const TaskDurationRow: React.FC<{ minutes?: number | null }> = ({ minutes }) =>
  renderTaskField({ estimatedDuration: minutes }, "estimatedDuration") || null;

export const ScheduledSessionsSection: React.FC<{
  scheduledSessions?: ScheduledSession[];
  subtasks?: Subtask[];
  completedParts?: Set<string>;
  loadingParts?: Set<string>;
  onToggleSubtask?: (id: string) => void | Promise<void>;
  estimatedDuration?: number | null;
  progressPercentage?: number | null; // 0-100
}> = ({
  scheduledSessions,
  subtasks,
  completedParts = new Set(),
  loadingParts = new Set(),
  onToggleSubtask,
  estimatedDuration,
  progressPercentage = null,
}) => {
  if (!scheduledSessions || scheduledSessions.length === 0) return null;

  const items: ListCellProps[] = (scheduledSessions || []).map((session, index) => {
    const subtaskId = (session as any).subtaskId || (session as any).subtaskId;
    const isDone = subtaskId ? completedParts.has(subtaskId) : false;
    const canToggle = Boolean(subtaskId);
    const isLoading = loadingParts.has(subtaskId || "");

    const { width } = useWindowDimensions();
    const row = sessionRowData(session, subtasks, index, { width });

    return {
      id: session.id || session.start || `session-${index}`,
      content: (
        <View style={{ width: "100%", flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 40, justifyContent: "center", paddingRight: SPACING.sm / 2 }}>
            {subtaskId ? (
              <Checkbox
                checked={isDone}
                onChange={() => canToggle && onToggleSubtask?.(subtaskId)}
                size={ICON_SIZES.sm}
              />
            ) : null}
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="notes" style={styles.scheduleDateTime}>
              {row.dateText}
              {row.timeRangeText ? (
                <AppText variant="notes" style={styles.scheduleTime}>
                  {" "}
                  {row.timeRangeText}
                </AppText>
              ) : null}
            </AppText>
            <AppText variant="bodyText" style={[styles.scheduleLabel]}>
              {row.label}
            </AppText>
          </View>

          <View style={{ width: 70, paddingLeft: SPACING.sm, alignItems: "flex-end", justifyContent: "flex-start" }}>
            {row.durationMinutes ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm / 2 }}>
                <Icon name="clock" size={ICON_SIZES.sm} color={COLORS.lightGray} />
                <AppText variant="notes" style={styles.scheduleTime}>
                  {formatDuration(row.durationMinutes)}
                </AppText>
              </View>
            ) : (
              <AppText variant="notes" style={{ color: COLORS.lightGray }}>
                {row.timeRangeText}
              </AppText>
            )}
          </View>
        </View>
      ),
      onPress: () => canToggle && onToggleSubtask?.(subtaskId),
      disabled: !canToggle || isLoading,
      divider: true,
    } as ListCellProps;
  });

  const progressValue =
    typeof progressPercentage === "number" ? Math.max(0, Math.min(1, progressPercentage / 100)) : undefined;

  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
        {typeof progressValue === "number" ? (
          <ProgressIcon value={progressValue} size={ICON_SIZES.md} />
        ) : (
          <View style={{ width: ICON_SIZES.md }} />
        )}
        <AppText>
          <AppText variant="title3" style={styles.sectionTitle}>
            {"Scheduled Sessions "}
          </AppText>
          <AppText variant="notes">{formatDuration(estimatedDuration ?? undefined)}</AppText>
        </AppText>
      </View>
      <List data={items} />
    </View>
  );
};
const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  titleText: {
    fontWeight: "600",
    flex: 1,
    textAlign: "left",
  },
  icon: {
    marginLeft: SPACING.sm,
    marginBottom: -2,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
    marginTop: SPACING.sm,
  },
  tagItem: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm / 2,
  },
  field: {
    marginBottom: SPACING.md,
    gap: 4,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  gridItem: {
    width: "48%",
    marginBottom: SPACING.sm,
  },
  labelText: {
    color: COLORS.lightGray,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  labelIcon: {
    marginRight: SPACING.sm / 2,
  },
  section: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  scheduleList: {
    gap: SPACING.sm,
  },
  scheduleDateTime: {
    color: COLORS.primary1,
    fontWeight: "700",
    marginBottom: 2,
  },
  scheduleTime: {
    color: COLORS.lightGray,
  },
  scheduleLabel: {
    fontWeight: "600",
  },
});
