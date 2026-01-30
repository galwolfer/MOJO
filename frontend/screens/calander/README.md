# Calendar Screen - Modular Architecture

This directory contains the modular implementation of the Calendar screen, split into focused components, hooks, and utilities.

## Directory Structure

```
calendar/
├── Calendar.tsx              # Main screen component
├── components/               # UI components
│   ├── index.ts             # Component exports
│   ├── CalendarHeader.tsx   # Header with title & date selector
│   ├── EmptyState.tsx       # Empty state view
│   ├── FloatingActionButton.tsx  # FAB for adding tasks
│   ├── SubtaskItem.tsx      # Individual subtask display
│   ├── TaskCard.tsx         # Task card (compact & expanded)
│   └── TaskGroup.tsx        # Date group wrapper
├── hooks/                   # Custom hooks
│   └── useCalendarTasks.ts  # Task management logic
└── types/                   # TypeScript definitions
    └── index.ts            # Task, Subtask, TaskGroup types
```

## Components

### CalendarScreen (Calendar.tsx)
Main screen component that orchestrates all child components and hooks.

**Props:** None (uses context)

**Features:**
- Date selection state management
- Task expansion state
- Calendar picker toggle
- Animation for empty state
- Integration with navigation and task contexts

### CalendarHeader
Header section with title, calendar icon, and date selector.

**Props:**
- `selectedDate: Date` - Currently selected date
- `setSelectedDate: (date: Date) => void` - Date setter
- `showCalendarPicker: boolean` - Calendar picker visibility
- `setShowCalendarPicker: (show: boolean) => void` - Toggle picker

### TaskCard
Displays a task in compact or expanded view.

**Props:**
- `task: Task` - Task data
- `isExpanded: boolean` - Expansion state
- `isCompleted: boolean` - Completion state
- `completedSubtasks: Set<string>` - Completed subtask IDs
- `onPress: (taskId: string) => void` - Toggle expand/collapse
- `onToggleCompletion: (taskId: string, checked: boolean) => void` - Toggle task completion
- `onEdit: (task: Task) => void` - Edit handler
- `onDelete: (taskId: string) => void` - Delete handler
- `onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void` - Subtask toggle
- `onSubtaskDelete: (taskId: string, subtaskId: string) => void` - Subtask delete

**Views:**
- **Compact**: Time, title, category icon, progress indicator
- **Expanded**: Full details with tags, subtasks, description, actions

### SubtaskItem
Individual subtask display with checkbox and delete button.

**Props:**
- `subtask: Subtask` - Subtask data
- `parentTaskId: string` - Parent task ID
- `isCompleted: boolean` - Completion state
- `onToggle: (parentTaskId: string, subtaskId: string, checked: boolean) => void` - Toggle handler
- `onDelete: (parentTaskId: string, subtaskId: string) => void` - Delete handler

### TaskGroup
Wraps tasks for a specific date with a date header.

**Props:**
- `group: TaskGroup` - Task group data
- `expandedTaskId: string | null` - Currently expanded task
- `completedTasks: Set<string>` - Completed task IDs
- `completedSubtasks: Set<string>` - Completed subtask IDs
- `onTaskPress: (taskId: string) => void` - Task press handler
- `onTaskToggle: (taskId: string, checked: boolean) => void` - Task completion toggle
- `onTaskEdit: (task: Task) => void` - Edit handler
- `onTaskDelete: (taskId: string) => void` - Delete handler
- `onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void` - Subtask toggle
- `onSubtaskDelete: (taskId: string, subtaskId: string) => void` - Subtask delete

### EmptyState
Displays when no tasks exist for the selected date.

**Props:**
- `rotationValue: Animated.Value` - Animation value for logo rotation
- `showCalendarPicker: boolean` - Calendar picker visibility
- `onAddTask: () => void` - Add task handler

### FloatingActionButton
Floating action button for quick task creation.

**Props:**
- `onPress: () => void` - Button press handler

## Hooks

### useCalendarTasks
Custom hook encapsulating all task management logic.

**Parameters:**
- `selectedDate: Date` - Currently selected date
- `notifyTaskUpdate: () => void` - Context update notifier
- `subscribeToTaskUpdates: (callback: () => void) => () => void` - Update subscriber

**Returns:**
- `taskGroups: TaskGroup[]` - All task groups
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message
- `completedTasks: Set<string>` - Completed task IDs
- `completedSubtasks: Set<string>` - Completed subtask IDs
- `fetchTasksForDate: (date: Date) => Promise<void>` - Fetch tasks
- `handleTaskCompletionToggle: (taskId: string, checked: boolean) => Promise<void>` - Toggle task
- `handleSubtaskCompletionToggle: (taskId: string, subtaskId: string, checked: boolean) => Promise<void>` - Toggle subtask
- `handleDeleteTask: (taskId: string) => Promise<void>` - Delete task
- `handleDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>` - Delete subtask
- `getLocalDateString: (date: Date) => string` - Date formatter
- `getFilteredTaskGroups: () => TaskGroup[]` - Filter tasks by date

## Types

### Task
```typescript
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
  dateString?: string;
  partNumber?: number;
  totalParts?: number;
  parentTaskName?: string;
}
```

### Subtask
```typescript
interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  timeRange?: string;
}
```

### TaskGroup
```typescript
interface TaskGroup {
  date: string;
  tasks: Task[];
}
```

## Theme Compliance

All components use theme tokens from `theme.ts`:

- **Colors**: `COLORS.*` (no hardcoded hex values except for specific cases)
- **Spacing**: `SPACING.*` (xs, sm, md, lg, xlg)
- **Fonts**: `FONTS.*` (fredoka family)
- **Font Sizes**: `FONT_SIZES.*` (sm, base, md, lg, xlg)
- **Shadows**: `SHADOWS.*` (card, header)
- **Typography**: `TYPOGRAPHY.*` (title, bodyText, notes, etc.)

## Benefits of This Structure

1. **Separation of Concerns**: Each component has a single responsibility
2. **Reusability**: Components can be reused across the app
3. **Testability**: Small, focused components are easier to test
4. **Maintainability**: Easier to locate and fix bugs
5. **Scalability**: New features can be added without affecting existing code
6. **Theme Consistency**: All components use centralized theme tokens
7. **Type Safety**: TypeScript types are centralized and reusable
8. **Performance**: Logic extraction to hooks prevents unnecessary re-renders

## Usage Example

```tsx
import { CalendarScreen } from './screens/calendar/Calendar';

// In your navigation or layout component
<CalendarScreen />
```

Or import individual components:

```tsx
import { TaskCard, SubtaskItem } from './screens/calendar/components';

// Use components individually
<TaskCard task={task} {...props} />
```

## Migration Notes

The original `Calendar.tsx` file in `frontend/screens/` should be removed after verifying the new modular implementation works correctly. Update all imports to point to `calendar/Calendar.tsx`.
