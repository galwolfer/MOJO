import React, { useEffect, useRef, useState } from "react";

/**
 * CalendarScreen
 *
 * A professional task management calendar view that displays tasks organized by date.
 * Features:
 * - 7-day horizontal date selector with navigation
 * - Tasks grouped by date in rounded containers
 * - Category icons and color-coded task bars
 * - Subtask support with completion state
 * - Floating action button for quick task creation
 * - Clickable/expandable tasks with detailed view
 *
 * Usage:
 * ```tsx
 * <CalendarScreen />
 * ```
 */
import { View, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Animated } from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, TYPOGRAPHY, FONTS } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import { getCategoryMeta } from "../config/categoryMeta";
import { Checkbox } from "../components/icons/Checkbox.native";
import { ProgressIcon } from "../components/icons/ProgressIcon.native";
import DateSelector from "../components/layout/DateSelector";
import CalendarPicker from "../components/inputs/CalendarPicker";

/**
 * Subtask interface
 */
interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
}

/**
 * Task interface with category support
 */
interface Task {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  emoji: string;
  tags: string[];
  dueDate: string;
  description: string;
  completed: boolean;
  color: string;
  category?: string;
  subtasks?: Subtask[];
  dateString?: string; // Date in YYYY-MM-DD format for filtering
}

/**
 * TaskGroup interface for date-based organization
 */
interface TaskGroup {
  date: string;
  tasks: Task[];
}

/**
 * CalendarScreen Component
 *
 * Displays a calendar view with tasks organized by date. Each date group is
 * wrapped in a white rounded container. Tasks show a color bar, category icon,
 * and all relevant metadata (time, emoji, tags, subtasks, description).
 */
export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab } = useNavigation();

  const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [selectedDate, setSelectedDate] = useState<Date>(() => stripTime(new Date()));
  useEffect(() => {
    setSelectedDate(stripTime(new Date()));
  }, []);

  // Animation for Mojo logo rotation
  const rotationValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotationValue]);

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  const taskGroups: TaskGroup[] = [
    {
      date: "WEDNESDAY, DECEMBER 10, 2025",
      tasks: [
        {
          id: "1",
          time: "09:00",
          endTime: "10:00",
          title: "BUY FLOWERS",
          emoji: "❤️",
          tags: ["Relationships"],
          dueDate: "Due to: 11/2/2025",
          description: "Go to the nearest flower and buy flowers",
          completed: false,
          color: "#FF69B4",
          category: "relationship",
          dateString: "2025-12-10",
        },
        {
          id: "2",
          time: "09:30",
          endTime: "11:30",
          title: "Finish 3 out of 4 exercises in Advanced Algorithms",
          emoji: "📚",
          tags: ["Study & Education"],
          dueDate: "Due to: 12/15/2025",
          description: "Complete the remaining exercises in the Advanced Algorithms course",
          completed: false,
          color: "#FFA726",
          category: "study_and_education",
          dateString: "2025-12-10",
          subtasks: [
            { id: "2a", title: "Exercise 1", description: "Complete binary search tree implementation", completed: true },
            { id: "2b", title: "Exercise 2", description: "Implement quicksort algorithm with optimizations", completed: true },
            { id: "2c", title: "Exercise 3", description: "Solve dynamic programming problem", completed: false },
          ],
        },
        {
          id: "3",
          time: "10:30",
          endTime: "11:30",
          title: "Go for a run in the park",
          emoji: "🌿",
          tags: ["Workout", "Health"],
          dueDate: "Due to: 12/10/2025",
          description: "Run for 30-40 minutes in the morning at the park",
          completed: false,
          color: "#66BB6A",
          category: "workout",
          dateString: "2025-12-10",
        },
        {
          id: "4",
          time: "15:30",
          endTime: "20:30",
          title: "Watch Mission Impossible with friends",
          emoji: "🎬",
          tags: ["Entertainment", "Social"],
          dueDate: "Due to: 12/10/2025",
          description: "Watch Mission Impossible at the cinema with friends. Remember to book tickets in advance",
          completed: false,
          color: "#AB47BC",
          category: "hobbies",
          dateString: "2025-12-10",
        },
      ],
    },
    {
      date: "THURSDAY, DECEMBER 11, 2025",
      tasks: [
        {
          id: "5",
          time: "10:00",
          endTime: "14:30",
          title: "Machine Learning exercise",
          emoji: "🤖",
          tags: ["Skill Building", "ML"],
          dueDate: "Due to: 12/12/2025",
          description: "Complete the machine learning assignment and submit code to GitHub",
          completed: false,
          color: "#42A5F5",
          category: "skill_building",
          dateString: "2025-12-11",
        },
        {
          id: "6",
          time: "17:00",
          endTime: "18:30",
          title: "Upper body workout session",
          emoji: "🌿",
          tags: ["Workout", "Fitness"],
          dueDate: "Due to: 12/11/2025",
          description: "Focus on chest, shoulders, and arms. 3 sets of 10 reps each",
          completed: false,
          color: "#66BB6A",
          category: "workout",
          dateString: "2025-12-11",
        },
      ],
    },
  ];

  useEffect(() => {
    setHeaderConfig({
      show: false,
    });
  }, [setHeaderConfig]);

  const handleAddTask = () => {
    setActiveTab("create");
  };

  const handleEditTask = (taskToEdit: Task) => {
    // Navigate to EditTask screen
    // For now, we'll create a simple navigation by setting a modal state
    // In a production app, you'd use React Navigation with route params
    console.log("Editing task:", taskToEdit);
    setActiveTab("edit" as any);
  };

  /**
   * Convert local Date to YYYY-MM-DD string without UTC conversion
   * Fixes timezone offset bugs where selecting a date can shift by one day
   */
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Get tasks filtered by selected date
   */
  const getFilteredTaskGroups = (): TaskGroup[] => {
    const selectedDateString = getLocalDateString(selectedDate);
    
    const filteredGroups: TaskGroup[] = [];
    
    taskGroups.forEach(group => {
      const matchingTasks = group.tasks.filter(task => task.dateString === selectedDateString);
      
      if (matchingTasks.length > 0) {
        filteredGroups.push({
          date: group.date,
          tasks: matchingTasks,
        });
      }
    });
    
    return filteredGroups;
  };

  const filteredTaskGroups = getFilteredTaskGroups();

  /**
   * Renders empty state when no tasks exist for selected date
   */
  const renderEmptyState = () => {
    const rotation = rotationValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
    <View style={[styles.emptyStateContainer, showCalendarPicker && styles.emptyStateContainerWithCalendar]}>
      <View style={styles.emptyStateContent}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          {ICONS.bestojo && React.createElement(ICONS.bestojo, {
            size: 120,
            color: COLORS.primary1,
          })}
        </Animated.View>
        
        <AppText style={styles.emptyStateTitle}>No Tasks Today</AppText>
        
        <AppText style={styles.emptyStateDescription}>
          You have cleared your schedule!
        </AppText>
        
        <AppText style={styles.emptyStateSubtext}>
          Want to add a new task or goal for this day?
        </AppText>
        
        <TouchableOpacity 
          style={styles.emptyStateButton}
          activeOpacity={0.8}
          onPress={handleAddTask}
        >
          <AppText style={styles.emptyStateButtonText}>+ Add Task</AppText>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  /**
   * Calculate progress for a task with subtasks
   * Returns a value between 0 and 1 representing completion percentage
   */
  const getTaskProgress = (task: Task): number => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completedCount = task.subtasks.filter(s => completedSubtasks.has(s.id)).length;
    return completedCount / task.subtasks.length;
  };

  const renderSubtask = (subtask: Subtask) => (
    <View key={subtask.id} style={styles.subtaskContainer}>
      <View style={styles.subtaskRow}>
        <Checkbox 
          checked={completedSubtasks.has(subtask.id)}
          onChange={(checked) => {
            const newCompleted = new Set(completedSubtasks);
            if (checked) {
              newCompleted.add(subtask.id);

            } else {
              newCompleted.delete(subtask.id);
            }
            setCompletedSubtasks(newCompleted);
          }}
          size={18}
        />
        <AppText 
          variant="notes"
          style={[styles.subtaskText, completedSubtasks.has(subtask.id) && styles.subtaskTextCompleted]}
        >
          {subtask.title}
        </AppText>
      </View>
      {subtask.description && (
        <AppText 
          style={[styles.subtaskDescription, completedSubtasks.has(subtask.id) && styles.subtaskDescriptionCompleted]}
        >
          {subtask.description}
        </AppText>
      )}
    </View>
  );

  /**
   * Handles task card press - toggles expand/collapse
   */
  const handleTaskPress = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  /**
   * Renders compact task card (collapsed state) or expanded view (when clicked)
   */
  const renderTaskCardCompact = (task: Task) => {
    const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
    const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;
    const isExpanded = expandedTaskId === task.id;

    // If expanded, show only the expanded view
    if (isExpanded) {
      return (
        <TouchableOpacity 
          key={`${task.id}-expanded`} 
          style={styles.taskExpandedContainer}
          onPress={() => handleTaskPress(task.id)}
          activeOpacity={0.9}
        >
          {/* Full-height color bar on the left */}
          <View style={[styles.expandedColorBarFull, { backgroundColor: categoryMeta?.color || task.color }]} />

          {/* Top-right edit button */}
          <TouchableOpacity 
            style={styles.expandedEditButtonTopRight}
            onPress={() => handleEditTask(task)}
          >
            <ICONS.edit size={18} color={COLORS.darkGray} />
          </TouchableOpacity>

          {/* Main layout: Left (time + endTime) + Right (all content) */}
          <View style={styles.expandedMainRow}>
            {/* Left side: Time and End Time */}
            <View style={styles.expandedLeftSection}>
              <AppText style={styles.expandedTime}>{task.time}</AppText>
              <View style={{ flex: 1 }} />
              {task.endTime && (
                <AppText style={styles.expandedEndTime}>{task.endTime}</AppText>
              )}
            </View>
            
            {/* Right side: All content */}
            <View style={styles.expandedRightSection}>
              {/* Title Row with Checkbox */}
              <View style={styles.expandedTitleRowInline}>
                <Checkbox 
                  checked={completedTasks.has(task.id)}
                  onChange={(checked) => {
                    const newCompleted = new Set(completedTasks);
                    const newSubtasksCompleted = new Set(completedSubtasks);
                    
                    if (checked) {
                      newCompleted.add(task.id);
                      // Check all subtasks
                      if (task.subtasks) {
                        task.subtasks.forEach(st => newSubtasksCompleted.add(st.id));
                      }
                    } else {
                      newCompleted.delete(task.id);
                      // Uncheck all subtasks
                      if (task.subtasks) {
                        task.subtasks.forEach(st => newSubtasksCompleted.delete(st.id));
                      }
                    }
                    
                    setCompletedTasks(newCompleted);
                    setCompletedSubtasks(newSubtasksCompleted);
                  }}
                  size={24}
                />
                {IconComponent && categoryMeta && (
                  React.createElement(IconComponent, {
                    size: 20,
                    color: categoryMeta.color,
                  })
                )}
                <AppText style={styles.expandedTitleInline}>{task.title}</AppText>
              </View>

              {/* Progress Circle and Tags Row */}
              <View style={styles.expandedProgressAndTagsRow}>
                {/* Progress Circle for Subtasks */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <ProgressIcon value={getTaskProgress(task)} size={24} />
                )}
                
                {/* Tags */}
                {task.tags.length > 0 && (
                  <View style={styles.expandedTagsContainer}>
                    {task.tags.map((tag, idx) => (
                      <View key={idx} style={styles.expandedTag}>
                        {IconComponent && (
                          React.createElement(IconComponent, {
                            size: 12,
                            color: "#c70d5e",
                          })
                        )}
                        <AppText style={styles.expandedTagText}>{tag}</AppText>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Due Date */}
              {task.dueDate && (
                <AppText style={styles.expandedDueDate}>{task.dueDate}</AppText>
              )}

              {/* Description */}
              {task.description && (
                <AppText style={styles.expandedDescription}>{task.description}</AppText>
              )}

              {/* Subtasks */}
              {task.subtasks && task.subtasks.length > 0 && (
                <View style={styles.expandedSubtasksContainer}>
                  {task.subtasks.map(renderSubtask)}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Otherwise, show compact view
    return (
      <TouchableOpacity 
        key={`${task.id}-compact`}
        style={styles.taskCardCompact}
        onPress={() => handleTaskPress(task.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.taskColorBarCompact, { backgroundColor: categoryMeta?.color || task.color }]} />
        
        <View style={styles.taskCompactLeft}>
          <AppText style={styles.taskTimeCompact}>{task.time}</AppText>
          {task.endTime && (
            <AppText style={styles.taskTimeSeparatorCompact}>{task.endTime}</AppText>
          )}
        </View>

        <View style={styles.taskCompactMiddle}>
          <View style={styles.taskTitleRowCompact}>
            <Checkbox 
              checked={completedTasks.has(task.id)}
              onChange={(checked) => {
                const newCompleted = new Set(completedTasks);
                const newSubtasksCompleted = new Set(completedSubtasks);
                
                if (checked) {
                  newCompleted.add(task.id);
                  // Check all subtasks
                  if (task.subtasks) {
                    task.subtasks.forEach(st => newSubtasksCompleted.add(st.id));
                  }
                } else {
                  newCompleted.delete(task.id);
                  // Uncheck all subtasks
                  if (task.subtasks) {
                    task.subtasks.forEach(st => newSubtasksCompleted.delete(st.id));
                  }
                }
                
                setCompletedTasks(newCompleted);
                setCompletedSubtasks(newSubtasksCompleted);
              }}
              size={20}
            />
            {IconComponent && categoryMeta && (
              React.createElement(IconComponent, {
                size: 18,
                color: categoryMeta.color,
              })
            )}
            <AppText style={styles.taskTitleCompact}>{task.title}</AppText>
          </View>
        </View>

        <View style={styles.taskCompactRight}>
          {task.subtasks && task.subtasks.length > 0 && (
            <ProgressIcon value={getTaskProgress(task)} size={24} />
          )}
          <TouchableOpacity onPress={() => handleEditTask(task)}>
            {IconComponent && categoryMeta && (
              <View style={[styles.categoryIconContainerCompact, { backgroundColor: categoryMeta.color }]}>
                {React.createElement(IconComponent, {
                  size: 16,
                  color: COLORS.colorWhite,
                })}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Renders a task card with all metadata
   */
  const renderTaskCard = (task: Task, isLast = false) => {
    const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
    const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;

    return (
      <View key={task.id} style={[styles.taskCard, isLast && styles.taskCardLast]}>
        <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <View style={styles.taskTimeContainer}>
              <AppText style={styles.taskTime}>{task.time}</AppText>
              {task.endTime && (
                <>
                  <AppText style={styles.taskTimeSeparator}>-</AppText>
                  <AppText style={styles.taskTime}>{task.endTime}</AppText>
                </>
              )}
            </View>
            <View style={styles.taskActions}>
              <TouchableOpacity style={styles.checkbox}>
                <View style={styles.checkboxInner} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton}>
                <ICONS.edit size={18} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.taskTitleRow}>
            <AppText style={styles.taskEmoji}>{task.emoji}</AppText>
            <AppText style={styles.taskTitle}>{task.title}</AppText>
          </View>
          
          {task.subtasks && task.subtasks.length > 0 && (
            <View style={styles.subtasksContainer}>
              {task.subtasks.map(renderSubtask)}
            </View>
          )}
          
          {task.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {task.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <ICONS.heart size={12} color="#C2185B" />
                  <AppText style={styles.tagText}>{tag}</AppText>
                </View>
              ))}
            </View>
          )}
          
          {task.dueDate && <AppText variant="notes" style={styles.dueDate}>{task.dueDate}</AppText>}
          {task.description && <AppText variant="bodyText" style={styles.description}>{task.description}</AppText>}
        </View>

        {/* Category Icon on the right (small circular badge) */}
        {IconComponent && categoryMeta && (
          <View style={[styles.categoryIconContainer, { backgroundColor: categoryMeta.color }]}>
            {React.createElement(IconComponent, {
              size: 18,
              color: COLORS.colorWhite,
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Title and Day Selector */}
      <View style={styles.headerWrapper}>
        {/* OUTER: shadow only (must NOT be overflow hidden) */}
        <View style={styles.headerOuterShadow}>
          {/* INNER: rounded + clip */}
          <View style={styles.headerInnerClip}>
            <View style={styles.headerCard}>
              <View style={styles.headerTitleRow}>
                <TouchableOpacity 
                  style={styles.headerIcon}
                  onPress={() => setShowCalendarPicker(!showCalendarPicker)}
                  activeOpacity={0.7}
                >
                  <ICONS.calendar size={28} color={COLORS.primary1} />
                </TouchableOpacity>
                <AppText style={styles.headerTitle}>MY TASKS</AppText>
              </View>

              {showCalendarPicker ? (
                <CalendarPicker 
                  onDateSelect={(dateString) => {
                    const date = new Date(dateString);
                    setSelectedDate(date);
                  }}
                  selectedDate={getLocalDateString(selectedDate)}
                  allowPastDates={true}
                  allowPreviousMonths={true}
                  lighterPastDates={true}
                />
              ) : (
                <DateSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              )}
            </View>
          </View>
        </View>
      </View>


      {/* Tasks List - Using Compact Cards */}
      <ScrollView 
        style={styles.tasksList}
        contentContainerStyle={styles.tasksListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTaskGroups.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredTaskGroups.map((group, groupIdx) => (
            <View key={groupIdx} style={styles.dayGroupContainer}>
            {/* Tasks for this date - wrapped in container with date header inside */}
            <View style={styles.tasksGroupWrapper}>
              <View style={styles.dateHeaderInWrapper}>
                <AppText style={styles.dateHeaderTextInWrapper}>{group.date}</AppText>
              </View>

              <View style={styles.tasksInner}>
                {group.tasks.map((task) => renderTaskCardCompact(task))}
              </View>
            </View>
          </View> 
        ))
        )}
      </ScrollView>

      {/* Floating ADD Button - Show only when there are tasks */}
      {filteredTaskGroups.length > 0 && (
        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.8}
          onPress={handleAddTask}
        >
          <AppText style={styles.floatingButtonText}>+</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  headerWrapper: {
    backgroundColor: COLORS.white3,
    overflow: "visible",
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    fontWeight: "600",
    paddingTop: 0,
  },

  headerCard: {
    backgroundColor: COLORS.colorWhite,
    width: "100%",

    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    paddingTop: Platform.OS === "android"
      ? (StatusBar.currentHeight ?? 0) + 6
      : 44,

    paddingHorizontal: SPACING.sm,
    paddingBottom: 0,
  },
  headerShadow: {
    // shadow only
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,

    // חשוב: לא לחתוך צל
    overflow: "visible",
  },
  headerIcon: {
    marginTop: 0,
    marginRight: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  tasksList: {
    flex: 1,
    backgroundColor: COLORS.white3,
    zIndex: 1,
    marginTop: -32,
  },
  tasksListContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingBottom: 160,
    paddingTop: 24 + (SPACING.md - 16),
  },
  dayGroupContainer: {
    marginBottom: SPACING.md,
  },
  dateHeaderInWrapper: {
    backgroundColor: COLORS.primary1,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dateHeaderTextInWrapper: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.colorWhite,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  tasksInner: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingLeft: 0,
  },
  tasksGroupWrapper: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 0,
    marginTop: 0,
    padding: 0,
    marginLeft: 5,
    marginRight: 5,
    ...(SHADOWS.card as object),
  },
  taskCard: {
    flexDirection: "row",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    backgroundColor: COLORS.colorWhite,
    alignItems: "flex-start",
  },
  taskCardLast: {
    borderBottomWidth: 0,
  },
  taskColorBar: {
    width: 4,
    marginRight: SPACING.md,
    marginVertical: 0,
  },
  taskContent: {
    flex: 1,
    paddingVertical: 0,
    paddingLeft: 0,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  taskTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  taskTimeSeparator: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  editButton: {
    padding: 2,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  taskEmoji: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  taskTitle: {
    fontFamily: FONTS.fredokaRegular,
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
  },
  tagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  dueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginBottom: 4,
  },
  description: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
  },
  categoryIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.md,
    alignSelf: "center",
    elevation: 2,
  },
  subtasksContainer: {
    marginLeft: 0,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    paddingLeft: SPACING.lg,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  subtaskContainer: {
    gap: 4,
  },
  subtaskText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "400",
  },
  subtaskDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginLeft: 26,
    lineHeight: 16,
  },
  subtaskTextCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescriptionCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskCheckboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  subtaskCheckmark: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.colorWhite,
    fontWeight: "700",
    fontFamily: FONTS.fredokaRegular,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: SPACING.lg,
    backgroundColor: "#2ecc71",
    borderRadius: 50,
    width: 56,
    height: 56,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 0,
    zIndex: 99,
    ...(SHADOWS.card as object),
  },
  floatingButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 24,
    textAlign: "center",
    fontFamily: FONTS.fredokaRegular,
    paddingHorizontal: 0,
  },
  // ===== EMPTY STATE STYLES =====
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
  },
  emptyStateContainerWithCalendar: {
    marginTop: -80,
  },
  emptyStateContent: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  emptyStateTitle: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyStateDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.darkGray,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptyStateButton: {
    backgroundColor: "#2ecc71",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  emptyStateButtonText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.white,
    fontWeight: "600",
    textAlign: "center",
  },
  // ===== COMPACT TASK CARD STYLES =====
  taskCardCompact: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    backgroundColor: "#edeffd",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  taskColorBarCompact: {
    width: 4,
    height: 60,
    borderRadius: 2,
  },
  taskCompactLeft: {
    justifyContent: "center",
    alignItems: "flex-start",
    minWidth: 45,
  },
  taskTimeCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    lineHeight: 16,
  },
  taskTimeSeparatorCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: SPACING.xlg,
  },
  taskCompactMiddle: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  taskTitleRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  taskEmojiCompact: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  taskTitleCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  taskCompactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoryIconContainerCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  heartButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  // ===== EXPANDED TASK STYLES (INLINE) =====
  taskExpandedContainer: {
    backgroundColor: COLORS.colorWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md + 8, // Add extra padding for the bar
    position: "relative",
  },
  expandedColorBarFull: {
    position: "absolute",
    left: SPACING.sm,
    top: SPACING.md,
    bottom: SPACING.md,
    width: 4,
    borderRadius: 2,
  },
  expandedEditButtonTopRight: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    padding: 4,
    zIndex: 10,
  },
  expandedMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  expandedLeftSection: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 40,
    justifyContent: "space-between",
  },
  expandedTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedEndTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedRightSection: {
    flex: 1,
    gap: SPACING.sm,
  },
  expandedTitleRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  expandedProgressAndTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  expandedProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  expandedEmojiInline: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  expandedTitleInline: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
    flexWrap: "wrap",
  },
  expandedTagsContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  expandedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expandedTagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  expandedDueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
  },
  expandedSubtasksContainer: {
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  expandedBottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  expandedEndTimeContainer: {
    position: "absolute",
    bottom: SPACING.md,
    left: SPACING.sm,
    marginLeft: 8,
  },
  // ===== MODAL STYLES (KEPT FOR REFERENCE, NOT USED) =====
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  taskDetailContainer: {
    backgroundColor: COLORS.colorWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  closeButtonText: {
    fontSize: 20,
    color: COLORS.darkGray,
    fontWeight: "600",
  },
  detailColorBar: {
    height: 4,
    width: "30%",
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  detailTimeSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  detailEndTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  detailRightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoryIconContainerDetail: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  heartButtonDetail: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  detailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailEmoji: {
    fontSize: 24,
    fontFamily: FONTS.fredokaRegular,
  },
  detailTitle: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.lg,
    color: COLORS.black,
    fontWeight: "700",
    lineHeight: 24,
    flex: 1,
  },
  detailTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailTagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  detailDueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginBottom: SPACING.sm,
  },
  detailDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  detailSubtasksContainer: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  detailCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  detailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.white2,
  },
  detailEditButton: {
    padding: 4,
  },
  selectedDot: {
    marginTop: 6,
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  headerOuterShadow: {
    marginBottom: 14,
    backgroundColor: COLORS.colorWhite,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    position: "relative", // חשוב לאנדרואיד כדי ש-zIndex יעבוד
    zIndex: 50,
    elevation: 50,

    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },

    overflow: "visible",
  },

  headerInnerClip: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    // IMPORTANT: clip content corners ONLY here
    overflow: "hidden",
  },

});
