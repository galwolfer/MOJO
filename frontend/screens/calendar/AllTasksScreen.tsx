/**
 * AllTasksScreen
 *
 * Full-screen view showing all user tasks in a filterable, sortable list.
 * Reached via the "list" icon in the MY TASKS header.
 *
 * Features:
 * - Filter by: overdue (due date passed), completion status
 * - Sort by: date created, due date, name, last updated
 * - Compact list items with category icon, subcategory icon, task name
 * - Tap a row to open a detail modal (reuses TaskDetailWidget components)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useColors } from "../../context/ThemeContext";
import ScrollableContent from "../../components/layout/ScrollableContent";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { SPACING, ICON_SIZES, FONTS, FONT_SIZES } from "../../theme";
import { ICONS } from "../../components/icons/icons";
import { Chevron } from "../../components/icons/Chevron";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import { getTasks, TaskWithSubtasks } from "../../services/taskService";
import TaskDetailModal from "../calendar/components/TaskDetailModal";
import Tag from "../../components/inputs/tag";
import { Box } from "../../components";
import List, { ListCellProps } from "../../components/layout/List";
import Icon from "../../components/icons/Icon";
import { ProgressIcon } from "../../components/icons/ProgressIcon.native";
import { getCategoryMeta } from "../../config/categoryMeta";

// ─── Filter / sort types ─────────────────────────────────────────────────────

type FilterKey = "all" | "overdue" | "completed" | "active";
type SortKey = "created" | "dueDate" | "name" | "updated";
type SortDir = "asc" | "desc";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "created", label: "Created" },
  { key: "dueDate", label: "Due Date" },
  { key: "name", label: "Name" },
  { key: "updated", label: "Updated" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AllTasksScreen() {
  const { setHeaderConfig, setActiveTab, setActiveTabWithParams } = useNavigation();
  const colors = useColors();
  const styles = getStyles(colors);
  const { subscribeToTaskUpdates } = useTaskContext();

  const [tasks, setTasks] = useState<TaskWithSubtasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedTask, setSelectedTask] = useState<TaskWithSubtasks | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // ── Header setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    setHeaderConfig({
      show: true,
      title: "ALL TASKS",
      leftElement: (
        <TouchableOpacity onPress={() => setActiveTab("calendar")} activeOpacity={0.7}>
          <ICONS.left size={ICON_SIZES.md} color={colors.primary1} />
        </TouchableOpacity>
      ),
    });
  }, [colors.primary1]);

  // ── Fetch tasks ──────────────────────────────────────────────────────────
  const fetchAllTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getTasks();
      setTasks(result);
    } catch (e: any) {
      setError(e?.message || "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  // Re-fetch when tasks are updated elsewhere in the app
  useEffect(() => {
    const unsub = subscribeToTaskUpdates(() => {
      fetchAllTasks();
    });
    return unsub;
  }, [fetchAllTasks, subscribeToTaskUpdates]);

  // ── Filtering ────────────────────────────────────────────────────────────
  const now = new Date().toISOString();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      switch (filter) {
        case "overdue":
          return t.dueDate && t.dueDate < now && t.status !== "done" && !t.completed;
        case "completed":
          return t.status === "done" || t.completed;
        case "active":
          return t.status !== "done" && !t.completed;
        default:
          return true;
      }
    });
  }, [tasks, filter, now]);

  // ── Sorting ──────────────────────────────────────────────────────────────
  const sortedTasks = useMemo(() => {
    const arr = [...filteredTasks];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.taskname || "").localeCompare(b.taskname || "");
          break;
        case "dueDate": {
          const aDate = a.dueDate || "";
          const bDate = b.dueDate || "";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "created":
          cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
          break;
        case "updated":
          cmp = (a.updatedAt || "").localeCompare(b.updatedAt || "");
          break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredTasks, sortBy, sortDir]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTaskPress = useCallback((task: TaskWithSubtasks) => {
    setSelectedTask(task);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedTask(null);
  }, []);

  const handleEditTask = useCallback(
    (task: TaskWithSubtasks) => {
      setDetailVisible(false);
      setActiveTabWithParams("edit" as any, { taskId: task._id });
    },
    [setActiveTabWithParams],
  );

  const toggleSortDir = useCallback(() => {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  // ── Build list cells from tasks ──────────────────────────────────────────
  const buildTaskListCell = (
    task: TaskWithSubtasks,
    onPress: (task: TaskWithSubtasks) => void,
    colors: ReturnType<typeof useColors>,
  ): ListCellProps => {
    const categoryMeta = getCategoryMeta(task.category);
    const subCat = task.subCategory;
    const subIcon = subCat?.icon;
    const progress =
      typeof task.progressPercentage === "number" ? Math.max(0, Math.min(1, task.progressPercentage / 100)) : 0;
    const isDone = task.status === "done" || task.completed;

    return {
      id: task._id,
      onPress: () => onPress(task),
      divider: true,
      content: (
        <View style={[listStyles.taskRow, isDone && listStyles.taskRowDone]}>
          <View style={listStyles.taskContent}>
            <ProgressIcon value={progress} size={ICON_SIZES.sm} />
            <AppText
              variant="bodyText"
              numberOfLines={1}
              style={[listStyles.taskName, isDone && listStyles.taskNameDone]}
            >
              {task.taskname || (task as any).title || "Untitled"}
            </AppText>
          </View>
          <View style={listStyles.taskIcons}>
            {subIcon && subIcon !== categoryMeta.icon ? (
              <Icon name={subIcon} size={ICON_SIZES.xs} color={colors.gray1} />
            ) : null}
            <Icon name={categoryMeta.icon as string} size={ICON_SIZES.sm} color={categoryMeta.color} />
          </View>
        </View>
      ),
    };
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollableContent
        respectHeader={true}
        respectNavBar={true}
        extraTopPadding={SPACING.lg}
        scrollKey="alltasks"
        contentContainerStyle={styles.content}
        extraBottomPadding={SPACING.xlg * 3}
      >
        {/* Filter & Sort chips */}
        <View style={styles.ChipsRow}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={[styles.chip, filter === opt.key && styles.chipActive]}
              activeOpacity={0.7}
            >
              <AppText variant="notes" style={[styles.chipText, filter === opt.key && styles.chipTextActive]}>
                {opt.label}
              </AppText>
            </TouchableOpacity>
          ))}

          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setSortBy(opt.key)}
              style={[styles.chip, sortBy === opt.key && styles.chipActive]}
              activeOpacity={0.7}
            >
              <AppText variant="notes" style={[styles.chipText, sortBy === opt.key && styles.chipTextActive]}>
                {opt.label}
              </AppText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={toggleSortDir} style={styles.sortDirBtn} activeOpacity={0.7}>
            <Chevron isOpen={sortDir === "asc"} size={ICON_SIZES.xs} color={colors.primary1} />
          </TouchableOpacity>
        </View>

        {/* Task count */}
        <AppText variant="notes" style={styles.countText}>
          {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </AppText>

        {/* List body */}
        {isLoading ? (
          <Box>
            <ActivityIndicator size="large" color={colors.primary1} />
            <AppText variant="bodyText" style={[styles.loadingText, { color: colors.gray1 }]}>
              Loading tasks…
            </AppText>
          </Box>
        ) : error ? (
          <Box>
            <AppText variant="boldText" style={[styles.errorTitle, { color: colors.primary7 }]}>
              Unable to Load Tasks
            </AppText>
            <AppText variant="bodyText" style={[styles.errorMessage, { color: colors.gray2 }]}>
              {error}
            </AppText>
            <AppButton title="Retry" onPress={fetchAllTasks} mode="filled" color="primary1" />
          </Box>
        ) : sortedTasks.length === 0 ? (
          <Box>
            <AppText variant="bodyText" style={[styles.emptyText, { color: colors.gray1 }]}>
              {filter === "all" ? "No tasks yet — create one!" : `No ${filter} tasks`}
            </AppText>
          </Box>
        ) : (
          <Box>
            <List
              data={sortedTasks.map((task) => buildTaskListCell(task, handleTaskPress, colors))}
              keyExtractor={(cell) => cell.id}
            />
          </Box>
        )}
      </ScrollableContent>

      {/* Task detail modal */}
      <TaskDetailModal
        visible={detailVisible}
        task={selectedTask}
        onClose={handleCloseDetail}
        onEdit={handleEditTask}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Styles generator using dynamic theme colors
const getStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: SPACING.xlg * 6,
    },
    ChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.xs,
    },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 1,
      borderRadius: SPACING.lg,
      backgroundColor: colors.bg1,
    },
    chipActive: {
      backgroundColor: colors.primary1,
      borderColor: colors.primary1,
    },
    chipText: {
      fontFamily: FONTS.fredokaRegular,
      fontSize: FONT_SIZES.sm,
      color: colors.gray2,
    },
    chipTextActive: {
      color: colors.text2,
      fontFamily: FONTS.fredokaSemiBold,
    },
    sortLabel: {
      color: colors.gray1,
      marginRight: SPACING.xs,
    },
    sortDirBtn: {
      padding: SPACING.xs,
      marginLeft: SPACING.xs,
    },
    countText: {
      color: colors.gray1,
      paddingHorizontal: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    listContainer: {
      backgroundColor: colors.text2,
      borderRadius: SPACING.lg,
      overflow: "hidden",
    },
    centerContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.xlg * 2,
      gap: SPACING.md,
    },
    loadingText: {
      // color applied inline
    },
    errorTitle: {
      // color applied inline
      textAlign: "center",
    },
    errorMessage: {
      // color applied inline
      textAlign: "center",
    },
    emptyText: {
      // color applied inline
      textAlign: "center",
    },
  });

// Task list item styles (for task rows within List component)
const listStyles = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  taskRowDone: {
    opacity: 0.6,
  },
  taskContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  taskIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  taskName: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    flex: 1,
  },
  taskNameDone: {
    textDecorationLine: "line-through",
  },
});
