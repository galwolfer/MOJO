# Task Scheduling API Integration

## Overview

After creating a task with the Calendar integration, you can now automatically generate a schedule for that task using intelligent CSP-based scheduling.

## API Endpoint

### Create Task Schedule
```
POST /api/tasks/:id/schedule
```

**Authentication:** Required (Bearer token)

**Request Body (optional):**
```json
{
  "planningHorizonDays": 14
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule created successfully. 3 session(s) scheduled.",
  "scheduledCount": 3,
  "unscheduledCount": 0,
  "plan": [
    {
      "start": "2026-01-24T09:00:00.000Z",
      "end": "2026-01-24T10:30:00.000Z",
      "minutes": 90,
      "taskId": "507f1f77bcf86cd799439011",
      "subtaskIndex": null
    }
  ],
  "unscheduled": []
}
```

## Frontend Usage

### In CreateTask.tsx

After successfully creating a task, call the schedule API:

```typescript
import { createTask, createTaskSchedule } from "../services/taskService";

const handleCreateTask = async () => {
  try {
    // Create the task
    const newTask = await createTask({
      taskname: formState.taskName,
      description: formState.description,
      category: formState.category,
      deadline: formState.timeToComplete,
      estimatedMinutes: parseInt(formState.estimatedMinutes) || 60,
      tags: formState.tags,
    });

    if (newTask) {
      // NOW: Generate automatic schedule for the task
      const schedule = await createTaskSchedule(newTask._id, {
        planningHorizonDays: 14,
      });

      if (schedule?.success) {
        console.log(`Created schedule with ${schedule.scheduledCount} sessions`);
        // Show success message to user
        showToast(`Task created and scheduled with ${schedule.scheduledCount} session(s)!`);
      } else {
        console.warn("Task created but scheduling failed");
        showToast("Task created successfully");
      }

      // Navigate away or clear form
      setActiveTab("calendar");
    }
  } catch (error) {
    console.error("Error creating task:", error);
    showToast("Failed to create task");
  }
};
```

### In Calendar.tsx

You can also manually trigger scheduling for existing tasks:

```typescript
import { createTaskSchedule } from "../services/taskService";

const handleScheduleTask = async (taskId: string) => {
  try {
    const result = await createTaskSchedule(taskId);
    if (result?.success) {
      showToast(`Task scheduled with ${result.scheduledCount} sessions`);
      // Optionally refetch to show updated schedule
      fetchTasksForDate(selectedDate);
    }
  } catch (error) {
    console.error("Failed to schedule task:", error);
    showToast("Failed to schedule task");
  }
};
```

## What Gets Scheduled

The scheduling algorithm considers:

✅ **Task Details**
- Estimated duration in minutes
- Task type (perfect, in_parts, leaky)
- Number of subtasks (if split task)

✅ **User Preferences**
- Working hours (from user profile)
- Daily capacity in minutes (from user profile)
- Planning horizon (days to schedule into future)

✅ **Constraints**
- Routine blocks (sleep, meals, shower, etc.)
- Existing busy blocks
- Already completed sessions
- Due dates

✅ **Optimization**
- Spreads tasks across available time slots
- Respects working hours
- Balances daily load
- Prioritizes tasks by due date and importance

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether scheduling succeeded |
| `message` | string | Human-readable status message |
| `scheduledCount` | number | How many schedule sessions were created |
| `unscheduledCount` | number | How many tasks couldn't fit in the schedule |
| `plan` | Array | Array of scheduled time slots |
| `unscheduled` | Array | Tasks that couldn't fit in the schedule |

## Schedule Session Fields

Each item in the `plan` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `start` | ISO string | Session start time |
| `end` | ISO string | Session end time |
| `minutes` | number | Duration in minutes |
| `taskId` | string | Task being scheduled |
| `subtaskIndex` | number\|null | Which subtask (if applicable) |

## Error Handling

```typescript
const schedule = await createTaskSchedule(taskId);

if (!schedule) {
  // Network error or API error
  console.error("Scheduling failed due to network error");
  return;
}

if (!schedule.success) {
  // Scheduling failed (no available time slots, etc.)
  console.warn("Could not schedule task:", schedule.message);
  return;
}

// Success
console.log(`${schedule.scheduledCount} sessions created`);
```

## Best Practices

1. **Call after task creation** - Immediately schedule after creating the task while user is engaged
2. **Handle failures gracefully** - Don't block user if scheduling fails (task is still created)
3. **Show user feedback** - Display number of scheduled sessions
4. **Allow manual re-scheduling** - Let users trigger scheduling again if their availability changes
5. **Update user profile** - Make sure user's working hours and daily capacity are set for better scheduling

## Planning Horizon

The `planningHorizonDays` parameter controls how far into the future to schedule:

- **Default:** 14 days
- **Range:** 1-90 days recommended
- **Usage:** `createTaskSchedule(taskId, { planningHorizonDays: 30 })`

## Integration Checklist

- [ ] Import `createTaskSchedule` from taskService
- [ ] Call after successful task creation in CreateTask.tsx
- [ ] Handle success/failure responses
- [ ] Show user feedback (toast/notification)
- [ ] Add optional manual re-schedule button in Calendar
- [ ] Test with various task durations
- [ ] Test with user having no available time slots
- [ ] Verify TaskSchedule records are created in database

## Database Impact

Calling this endpoint creates `TaskSchedule` documents:
- One per scheduled time slot
- Linked to the task via `taskId`
- Status set to "planned"
- Can be updated/deleted as user availability changes

## Next Steps

1. **Implement** in CreateTask form submission
2. **Test** with different planning horizons
3. **Monitor** schedule generation performance
4. **Add UI** to show scheduled sessions in Calendar
5. **Allow editing** of generated schedules (reschedule, skip, etc.)

## Troubleshooting

**Schedule created but not visible in Calendar:**
- Scheduled sessions are in `TaskSchedule` collection, not in Task list
- Calendar shows tasks, not their schedules
- Need separate view/query to show scheduled sessions

**No schedules generated (unscheduledCount > 0):**
- User's availability too limited
- Task duration exceeds planning horizon
- All time slots are occupied by routine/busy blocks
- Check user's working hours settings

**API returns error:**
- Task not found (wrong ID)
- User not found (authentication issue)
- Task already fully scheduled (may need to clear existing schedule first)
