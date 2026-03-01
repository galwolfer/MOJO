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
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING, ICON_SIZES, FONTS, FONT_SIZES } from "../../theme";
import { ICONS } from "../../components/icons/icons";
import { Chevron } from "../../components/icons/Chevron";
import { useNavigation } from "../../context/NavigationContext";
import { useLayout } from "../../context/LayoutContext";
import { useTaskContext } from "../../context/TaskContext";
import { getTasks, TaskWithSubtasks } from "../../services/taskService";
import TaskListItem from "../calendar/components/TaskListItem";
import TaskDetailModal from "../calendar/components/TaskDetailModal";
import Tag from "../../components/inputs/tag";

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
  const { dimensions } = useLayout();
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
          <ICONS.left size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
    });
  }, []);

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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: dimensions.headerHeight + SPACING.sm }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter chips */}
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
        </View>

        {/* Sort controls */}
        <View style={styles.ChipsRow}>
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
            <Chevron isOpen={sortDir === "asc"} size={ICON_SIZES.xs} color={COLORS.primary1} />
          </TouchableOpacity>
        </View>

        {/* Task count */}
        <AppText variant="notes" style={styles.countText}>
          {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </AppText>

        {/* List body */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary1} />
            <AppText variant="bodyText" style={styles.loadingText}>
              Loading tasks…
            </AppText>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <AppText variant="boldText" style={styles.errorTitle}>
              Unable to Load Tasks
            </AppText>
            <AppText variant="bodyText" style={styles.errorMessage}>
              {error}
            </AppText>
            <AppButton title="Retry" onPress={fetchAllTasks} mode="filled" color="primary1" />
          </View>
        ) : sortedTasks.length === 0 ? (
          <View style={styles.centerContainer}>
            <AppText variant="bodyText" style={styles.emptyText}>
              {filter === "all" ? "No tasks yet — create one!" : `No ${filter} tasks`}
            </AppText>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {sortedTasks.map((task) => (
              <TaskListItem key={task._id} task={task} onPress={handleTaskPress} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Task detail modal */}
      <TaskDetailModal
        visible={detailVisible}
        task={selectedTask}
        onClose={handleCloseDetail}
        onEdit={handleEditTask}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.sm,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.white2,
  },
  chipActive: {
    backgroundColor: COLORS.primary1,
    borderColor: COLORS.primary1,
  },
  chipText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  chipTextActive: {
    color: COLORS.colorWhite,
    fontFamily: FONTS.fredokaSemiBold,
  },
  sortLabel: {
    color: COLORS.lightGray,
    marginRight: SPACING.xs,
  },
  sortDirBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  countText: {
    color: COLORS.lightGray,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  listContainer: {
    backgroundColor: COLORS.colorWhite,
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
    color: COLORS.lightGray,
  },
  errorTitle: {
    color: COLORS.primary7,
    textAlign: "center",
  },
  errorMessage: {
    color: COLORS.darkGray,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.lightGray,
    textAlign: "center",
  },
});
