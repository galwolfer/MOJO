# Calendar Screen - Quick Integration Guide

## What's New

The Calendar screen now fetches **real data from your database** instead of using hardcoded synthetic data. All tasks are automatically transformed to the correct format and persisted when you mark them as complete.

## Key Features Implemented

### ✅ Real Data Integration
- Fetches tasks from backend API when screen loads
- Automatically fetches tasks when you select a different date
- Shows loading spinner while fetching

### ✅ Task Completion
- Click the checkbox next to a task to mark it complete
- Changes are **instantly saved to the database**
- If save fails, the UI reverts automatically

### ✅ Subtask Tracking
- Expand a task to see its subtasks
- Toggle subtask completion
- Progress bar shows % complete

### ✅ Real-Time Sync
- If another part of your app updates a task, Calendar automatically refreshes
- Uses TaskContext for app-wide synchronization

### ✅ Error Handling
- Shows friendly error messages if loading fails
- "Retry" button to reload tasks
- Optimistic updates (UI updates before API confirm)

## Code Examples

### Fetching Tasks for a Date
```typescript
import { getTasksForDate, CalendarTaskGroup } from "./services/taskService";

const groups: CalendarTaskGroup[] = await getTasksForDate(new Date());
// groups[0].date = "WEDNESDAY, JANUARY 23, 2026"
// groups[0].tasks = [{ id, title, completed, ... }]
```

### Transforming API Data
```typescript
import { transformTaskToCalendarFormat, CalendarTask } from "./services/taskService";

const calendarTask: CalendarTask = transformTaskToCalendarFormat(apiTask);
// Converts:
// - taskname → title
// - dueDate → time, dueDate (formatted), dateString
// - category → color, emoji (from metadata)
// - status → completed boolean
// - subTasks[] → subtasks[] with completion state
```

### Updating Task Completion
```typescript
import { updateTask } from "./services/taskService";
import { useTaskContext } from "./context/TaskContext";

const { notifyTaskUpdate } = useTaskContext();

await updateTask(taskId, {
  status: "done",
  completed: true,
});

// Notify other parts of app
notifyTaskUpdate();

// Calendar will auto-refetch via subscription
```

## Architecture

```
Calendar.tsx
  ↓
  fetchTasksForDate(date)
  ↓
  getTasksForDate(date)
  ↓
  getTasks({ dueAfter, dueBefore })  [API call]
  ↓
  transformTasksToCalendarGroups()  [Format conversion]
  ↓
  CalendarTaskGroup[]  [Display in UI]
  ↓
  (User clicks checkbox)
  ↓
  handleTaskCompletionToggle()
  ↓
  updateTask(taskId, { status, completed })  [API call]
  ↓
  notifyTaskUpdate()  [App-wide sync]
  ↓
  subscribeToTaskUpdates callback
  ↓
  fetchTasksForDate() refetch
```

## Type System

### Main Types
```typescript
// Calendar expects this format
interface CalendarTask {
  id: string;
  time: string;              // "09:00"
  endTime?: string;          // "10:30"
  title: string;             // Task name
  emoji: string;             // 📌 or similar
  tags: string[];            // ["Work", "Urgent"]
  dueDate: string;           // "Due to: 01/23/26"
  description: string;       // Full description
  completed: boolean;        // Is it done?
  color: string;             // Hex from category
  category?: string;         // "work", "study", etc.
  subtasks?: CalendarSubtask[];
  dateString?: string;       // "2026-01-23" (filtering)
}

// API returns this format
interface Task {
  _id: string;
  taskname: string;
  description?: string;
  category?: string;
  tags?: string[];
  status: "todo" | "in_progress" | "done";
  dueDate?: string;
  subTasks?: SubTask[];
  // ... other fields
}

// Transformation handles the mapping
const calendarTask = transformTaskToCalendarFormat(apiTask);
```

## Common Tasks

### Check if tasks are loading
```typescript
if (isLoading) {
  return <ActivityIndicator />;
}
```

### Check for errors
```typescript
if (error) {
  return (
    <View>
      <Text>{error}</Text>
      <Button title="Retry" onPress={() => fetchTasksForDate(selectedDate)} />
    </View>
  );
}
```

### Handle task completion
```typescript
const handleComplete = async (taskId: string) => {
  await handleTaskCompletionToggle(taskId, true);
  // Task is saved and refetched automatically
};
```

### Subscribe to changes
```typescript
useEffect(() => {
  const unsubscribe = subscribeToTaskUpdates(() => {
    console.log("Task was updated elsewhere!");
    fetchTasksForDate(selectedDate);
  });
  
  return unsubscribe;
}, [selectedDate, subscribeToTaskUpdates]);
```

## Debugging Tips

### Enable detailed logging
Add this to Calendar.tsx or taskService.ts:
```typescript
console.log("Fetching tasks for:", selectedDate);
const groups = await getTasksForDate(selectedDate);
console.log("Received groups:", groups);
```

### Check API response
Open DevTools Network tab and look for:
- `/api/tasks?dueAfter=...&dueBefore=...` requests
- Check response structure matches Task type

### Verify transformation
```typescript
import { transformTaskToCalendarFormat } from "./services/taskService";

const apiTask = { /* ... */ };
const calendarTask = transformTaskToCalendarFormat(apiTask);
console.log("Transformed task:", calendarTask);
```

### Test task persistence
1. Toggle a task in UI (should show completion immediately)
2. Check Network tab for PATCH request to `/api/tasks/{id}`
3. Refresh browser - completion should persist
4. Open app in different tab - it should sync automatically

## Known Limitations

1. **Emoji**: Currently uses placeholder "📌". Can be enhanced by adding emoji field to task or category metadata.

2. **Time**: Extracted from dueDate hour or defaults to "09:00". For precise scheduling, store explicit start/end times.

3. **Subtask Updates**: Currently persists to API but doesn't have dedicated subtask update endpoint. Works via task refresh.

4. **Timezone**: Uses local timezone. For multi-timezone apps, consider storing timezone with task.

5. **Cache**: No caching layer. Every date change fetches from API. Can add with Redux/Context cache.

## Next Steps

1. **Test with real data**: Create tasks in your app and verify they appear in Calendar
2. **Test completion**: Mark tasks complete and refresh - they should stay completed
3. **Test real-time sync**: Open Calendar in two windows, update in one, verify sync in other
4. **Add emoji support**: Store emoji in category metadata or task
5. **Implement caching**: Reduce API calls for previously viewed dates
6. **Add filters**: Filter by category, priority, completion status

## Files to Review

- `frontend/services/taskService.ts` - Data transformation logic
- `frontend/screens/Calendar.tsx` - UI integration
- `src/models/Task.js` - Backend Task schema
- `src/routes/tasks.js` - API endpoints
